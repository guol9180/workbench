package com.imhgl.workbench.infrastructure.metrics;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * 零依赖 JSONL 时序存储（技术设施，规范见 AGENTS.md 3.3）。整体是一个「内存聚合桶 + 按天快照日志」的结构：
 *
 * <p>设计取舍（为什么这么做）：
 * <ul>
 *   <li><b>分钟聚合桶</b>：写入按（分钟, 来源, 端点, 方法）归并，内存只存聚合值 + 有界延迟样本，
 *       个人流量级别（万级请求/天）内存可忽略；查询全走内存，无 IO。</li>
 *   <li><b>快照语义而非增量日志</b>：每次刷盘把脏桶的「当前全量状态」写成一行 JSONL，重放时
 *       同键后行覆盖前行。代价是热桶一分钟内最多写 ~12 行冗余快照（5s 刷盘 × 60s 桶生命周期），
 *       换来的是崩溃恢复逻辑极简——不存在的对账/增量丢失问题。</li>
 *   <li><b>蓄水池采样</b>：每桶延迟样本上限 200（{@code MAX_SAMPLES}），超限后按概率替换，
 *       用固定内存近似任意流量下的 p95 分位。</li>
 *   <li><b>单写线程</b>：刷盘与保留清理都在同一个守护线程串行执行——规避 Windows 上的文件锁竞争，
 *       也保证同一文件的追加天然互斥。</li>
 *   <li><b>UTC 日期文件名</b>：metrics-yyyyMMdd.jsonl 按天滚动，日期用 UTC 计算，避免部署时区变化导致文件漂移。</li>
 * </ul>
 *
 * <p>并发约定：append 走 {@link ConcurrentHashMap#compute}（同键串行合并），flush 读桶时短暂
 * synchronized 同桶互斥；查询是最终一致的近似视图，监测场景可接受。JSONL 行的编解码为本类内置的
 * 定 schema 手写实现——infrastructure 依赖树里没有 Jackson，也不想为此引依赖。
 */
@Service
public class JsonlTimeSeriesStore implements TimeSeriesStore {

    /** 每桶延迟样本上限：p95 精度与内存的折中，200 样本的分位误差对监测足够 */
    static final int MAX_SAMPLES = 200;

    private static final ZoneOffset ZONE = ZoneOffset.UTC;
    private static final Pattern FILE_NAME = Pattern.compile("metrics-(\\d{8})\\.jsonl");

    private final MetricsProperties properties;
    private final Path dataDir;
    private final ConcurrentHashMap<BucketKey, MinuteBucket> buckets = new ConcurrentHashMap<>();
    /** 脏键集合：自上次刷盘后被 append 命中的桶（ConcurrentHashMap.newKeySet 保证弱一致遍历） */
    private final ConcurrentHashMap.KeySetView<BucketKey, Boolean> dirty = ConcurrentHashMap.newKeySet();
    private final ScheduledExecutorService scheduler;

    /** 聚合桶键：分钟 + 来源 + 端点 + 方法（状态不进键——错误数以 errCount 表达，避免维度爆炸） */
    record BucketKey(long minute, String source, String endpoint, String method) {
    }

    /** 分钟聚合桶：字段仅在 compute（append）或 flush 的 synchronized 块内读写 */
    static final class MinuteBucket {
        long count;
        long errCount;
        long totalMs;
        long maxMs;
        /** 已见延迟样本总数（含被蓄水池替换掉的），用于替换概率 */
        long samplesSeen;
        final List<Integer> samples = new ArrayList<>();

        void merge(TrafficRecord r) {
            count += r.count();
            if (r.status() >= 400) {
                errCount += r.count();
            }
            totalMs += r.totalMs();
            maxMs = Math.max(maxMs, r.maxMs());
            for (int s : r.latencySamples()) {
                samplesSeen++;
                if (samples.size() < MAX_SAMPLES) {
                    samples.add(s);
                } else if (ThreadLocalRandom.current().nextDouble() * samplesSeen < MAX_SAMPLES) {
                    samples.set(ThreadLocalRandom.current().nextInt(MAX_SAMPLES), s);
                }
            }
        }
    }

    public JsonlTimeSeriesStore(MetricsProperties properties) {
        this.properties = properties;
        this.dataDir = Paths.get(properties.dataDir()).toAbsolutePath().normalize();
        try {
            Files.createDirectories(dataDir);
        } catch (IOException e) {
            throw new UncheckedIOException("无法创建监测数据目录：" + dataDir, e);
        }
        sweepRetention();
        replay();
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "metrics-store-flusher");
            t.setDaemon(true);
            return t;
        });
        scheduler.scheduleWithFixedDelay(this::flushAndSweepQuietly,
                properties.flushIntervalSeconds(), properties.flushIntervalSeconds(), TimeUnit.SECONDS);
    }

    @Override
    public void append(TrafficRecord record) {
        BucketKey key = new BucketKey(record.minute(), record.source(), record.endpoint(), record.method());
        buckets.compute(key, (k, b) -> {
            MinuteBucket bucket = b == null ? new MinuteBucket() : b;
            synchronized (bucket) {
                bucket.merge(record);
            }
            return bucket;
        });
        dirty.add(key);
    }

    @Override
    public List<SourceStat> sources() {
        Map<String, Long> lastSeen = new HashMap<>();
        for (Map.Entry<BucketKey, MinuteBucket> e : buckets.entrySet()) {
            lastSeen.merge(e.getKey().source(), e.getKey().minute(), Math::max);
        }
        return lastSeen.entrySet().stream()
                .map(s -> new SourceStat(s.getKey(), s.getValue()))
                .sorted(Comparator.comparing(SourceStat::name))
                .toList();
    }

    @Override
    public Overview overview(String source, long fromMinute, long toMinute) {
        long count = 0, err = 0, total = 0, max = 0;
        List<Integer> allSamples = new ArrayList<>();
        for (Map.Entry<BucketKey, MinuteBucket> e : inRange(source, fromMinute, toMinute)) {
            MinuteBucket b = e.getValue();
            synchronized (b) {
                count += b.count;
                err += b.errCount;
                total += b.totalMs;
                max = Math.max(max, b.maxMs);
                allSamples.addAll(b.samples);
            }
        }
        long avg = count == 0 ? 0 : total / count;
        // 无样本（外部聚合上报）时以 maxMs 近似 p95：宁可高估延迟感知，也不静默归零
        long p95 = allSamples.isEmpty() ? (count > 0 ? max : 0) : percentile(allSamples, 0.95);
        double rps = count / ((toMinute - fromMinute + 1) * 60.0);
        return new Overview(count, err, count == 0 ? 0 : err / (double) count, avg, p95, rps);
    }

    @Override
    public List<SeriesPoint> series(String source, String metric, long fromMinute, long toMinute, boolean hourly) {
        requireMetric(metric);
        // TreeMap 保证序列按时间升序输出；值数组为 [count, errCount, totalMs]
        Map<Long, long[]> groups = new TreeMap<>();
        for (Map.Entry<BucketKey, MinuteBucket> e : inRange(source, fromMinute, toMinute)) {
            long bucket = hourly ? e.getKey().minute() - e.getKey().minute() % 60 : e.getKey().minute();
            long[] agg = groups.computeIfAbsent(bucket, k -> new long[3]);
            MinuteBucket b = e.getValue();
            synchronized (b) {
                agg[0] += b.count;
                agg[1] += b.errCount;
                agg[2] += b.totalMs;
            }
        }
        List<SeriesPoint> points = new ArrayList<>(groups.size());
        for (Map.Entry<Long, long[]> e : groups.entrySet()) {
            long[] agg = e.getValue();
            long value = switch (metric) {
                case "count" -> agg[0];
                case "errCount" -> agg[1];
                case "avgMs" -> agg[0] == 0 ? 0 : agg[2] / agg[0];
                default -> throw new IllegalArgumentException("非法指标：" + metric);
            };
            points.add(new SeriesPoint(e.getKey(), value));
        }
        return points;
    }

    @Override
    public List<EndpointRank> topEndpoints(String source, long fromMinute, long toMinute, int limit, String by) {
        if (!by.equals("count") && !by.equals("err") && !by.equals("avgMs")) {
            throw new IllegalArgumentException("非法排序维度：" + by);
        }
        Map<String, long[]> byEndpoint = new LinkedHashMap<>(); // count, err, total
        Map<String, List<Integer>> samplesByEndpoint = new HashMap<>();
        Map<String, Long> maxByEndpoint = new HashMap<>();
        for (Map.Entry<BucketKey, MinuteBucket> e : inRange(source, fromMinute, toMinute)) {
            long[] agg = byEndpoint.computeIfAbsent(e.getKey().endpoint(), k -> new long[3]);
            MinuteBucket b = e.getValue();
            synchronized (b) {
                agg[0] += b.count;
                agg[1] += b.errCount;
                agg[2] += b.totalMs;
                if (!b.samples.isEmpty()) {
                    samplesByEndpoint.computeIfAbsent(e.getKey().endpoint(), k -> new ArrayList<>()).addAll(b.samples);
                }
                maxByEndpoint.merge(e.getKey().endpoint(), b.maxMs, Math::max);
            }
        }
        record Row(String endpoint, long count, long err, long avg, long p95) {
        }
        List<Row> rows = byEndpoint.entrySet().stream()
                .map(e -> {
                    long count = e.getValue()[0];
                    List<Integer> samples = samplesByEndpoint.get(e.getKey());
                    long p95 = samples == null || samples.isEmpty()
                            ? maxByEndpoint.getOrDefault(e.getKey(), 0L)
                            : percentile(samples, 0.95);
                    return new Row(e.getKey(), count, e.getValue()[1], count == 0 ? 0 : e.getValue()[2] / count, p95);
                })
                .sorted(switch (by) {
                    case "err" -> Comparator.comparingLong(Row::err).reversed();
                    case "avgMs" -> Comparator.comparingLong(Row::avg).reversed();
                    default -> Comparator.comparingLong(Row::count).reversed();
                })
                .limit(Math.max(0, limit))
                .toList();
        return rows.stream().map(r -> new EndpointRank(r.endpoint(), r.count(), r.err(), r.avg(), r.p95())).toList();
    }

    @Override
    public void flush() {
        if (dirty.isEmpty()) {
            return;
        }
        // 按天分组行缓冲：先取脏键快照再逐键清标记，期间的新 append 会重新标脏（最多多刷一次，不丢数据）
        Map<Path, StringBuilder> dayLines = new LinkedHashMap<>();
        for (BucketKey key : List.copyOf(dirty)) {
            dirty.remove(key);
            MinuteBucket b = buckets.get(key);
            if (b == null) {
                continue;
            }
            String line;
            synchronized (b) {
                line = JsonlCodec.write(key, b);
            }
            dayLines.computeIfAbsent(fileOf(key.minute()), p -> new StringBuilder()).append(line).append('\n');
        }
        dayLines.forEach((path, sb) -> {
            try {
                Files.writeString(path, sb, StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            } catch (IOException e) {
                // 刷盘失败不抛出：监测数据不值得让业务线程/定时线程死掉；脏数据已从 dirty 移除，
                // 下次该桶再被命中会重新刷——最坏丢一个刷盘周期，符合时序数据可容忍损失的定位
            }
        });
    }

    @Override
    public StoreStatus status() {
        int files = 0;
        try (Stream<Path> stream = Files.list(dataDir)) {
            files = (int) stream.filter(p -> FILE_NAME.matcher(p.getFileName().toString()).matches()).count();
        } catch (IOException ignored) {
            // 目录不可读时按 0 上报，自检端点不该抛
        }
        return new StoreStatus(buckets.size(), files);
    }

    @Override
    public void close() {
        scheduler.shutdown();
        flush();
    }

    // ---------- 内部机制 ----------

    private Iterable<Map.Entry<BucketKey, MinuteBucket>> inRange(String source, long from, long to) {
        return () -> buckets.entrySet().stream()
                .filter(e -> e.getKey().source().equals(source)
                        && e.getKey().minute() >= from && e.getKey().minute() <= to)
                .iterator();
    }

    private static void requireMetric(String metric) {
        if (!metric.equals("count") && !metric.equals("errCount") && !metric.equals("avgMs")) {
            throw new IllegalArgumentException("非法指标：" + metric);
        }
    }

    /** 分位数：升序排序后取 ceil(q*n)-1 位（最近邻秩），样本空集由调用方处理 */
    private static long percentile(List<Integer> samples, double q) {
        List<Integer> sorted = new ArrayList<>(samples);
        sorted.sort(Integer::compareTo);
        int idx = (int) Math.ceil(q * sorted.size()) - 1;
        idx = Math.max(0, Math.min(idx, sorted.size() - 1));
        return sorted.get(idx);
    }

    private Path fileOf(long minute) {
        LocalDate day = LocalDate.ofInstant(Instant.ofEpochMilli(minute * 60_000L), ZONE);
        return dataDir.resolve("metrics-" + day.toString().replace("-", "") + ".jsonl");
    }

    /** 定时任务入口：吞掉一切异常，防止 scheduleWithFixedDelay 因单次失败永久停摆 */
    private void flushAndSweepQuietly() {
        try {
            flush();
            sweepRetention();
        } catch (RuntimeException ignored) {
            // 同上：后台静默
        }
    }

    /** 保留策略：删除早于保留期的天文件与内存桶（粒度是天，不做分钟级删除） */
    private void sweepRetention() {
        LocalDate cutoff = LocalDate.now(ZONE).minusDays(properties.retentionDays());
        try (Stream<Path> stream = Files.list(dataDir)) {
            stream.forEach(p -> {
                Matcher m = FILE_NAME.matcher(p.getFileName().toString());
                if (m.matches() && LocalDate.parse(m.group(1).substring(0, 4) + "-"
                                + m.group(1).substring(4, 6) + "-" + m.group(1).substring(6, 8))
                        .isBefore(cutoff)) {
                    try {
                        Files.deleteIfExists(p);
                    } catch (IOException ignored) {
                        // 删不掉留给下一次清扫
                    }
                }
            });
        } catch (IOException ignored) {
            // 目录不可读时跳过本轮清理
        }
        long cutoffMinute = cutoff.atStartOfDay(ZONE).toInstant().toEpochMilli() / 60_000L;
        buckets.keySet().removeIf(k -> k.minute() < cutoffMinute);
    }

    /** 启动重放：顺序读全部数据文件，同键后行覆盖前行（快照语义），坏行跳过 */
    private void replay() {
        List<Path> files;
        try (Stream<Path> stream = Files.list(dataDir)) {
            files = stream.filter(p -> FILE_NAME.matcher(p.getFileName().toString()).matches()).sorted().toList();
        } catch (IOException e) {
            throw new UncheckedIOException("监测数据目录不可读：" + dataDir, e);
        }
        for (Path file : files) {
            try {
                for (String line : Files.readAllLines(file, StandardCharsets.UTF_8)) {
                    if (line.isBlank()) {
                        continue;
                    }
                    try {
                        JsonlCodec.ReadRow row = JsonlCodec.read(line);
                        BucketKey key = new BucketKey(row.minute(), row.source(), row.endpoint(), row.method());
                        MinuteBucket b = new MinuteBucket();
                        b.count = row.count();
                        b.errCount = row.errCount();
                        b.totalMs = row.totalMs();
                        b.maxMs = row.maxMs();
                        b.samplesSeen = row.samplesSeen();
                        b.samples.addAll(row.samples());
                        buckets.put(key, b);
                    } catch (RuntimeException malformed) {
                        // 坏行跳过：单行损坏不应阻断整个恢复
                    }
                }
            } catch (IOException ignored) {
                // 单文件不可读跳过，继续重放其余文件
            }
        }
    }

    /** 定 schema 的 JSONL 编解码：infrastructure 无 Jackson，也不为此引依赖——这正是本组件的学习点之一 */
    static final class JsonlCodec {

        private JsonlCodec() {
        }

        static String write(BucketKey key, MinuteBucket b) {
            StringBuilder sb = new StringBuilder(128);
            sb.append("{\"m\":").append(key.minute());
            sb.append(",\"s\":\"").append(escape(key.source()));
            sb.append("\",\"e\":\"").append(escape(key.endpoint()));
            sb.append("\",\"h\":\"").append(escape(key.method()));
            sb.append("\",\"c\":").append(b.count);
            sb.append(",\"ec\":").append(b.errCount);
            sb.append(",\"t\":").append(b.totalMs);
            sb.append(",\"x\":").append(b.maxMs);
            sb.append(",\"n\":").append(b.samplesSeen);
            sb.append(",\"l\":[");
            for (int i = 0; i < b.samples.size(); i++) {
                if (i > 0) {
                    sb.append(',');
                }
                sb.append(b.samples.get(i));
            }
            return sb.append("]}").toString();
        }

        record ReadRow(long minute, String source, String endpoint, String method,
                       long count, long errCount, long totalMs, long maxMs, long samplesSeen,
                       List<Integer> samples) {
        }

        static ReadRow read(String line) {
            Scanner sc = new Scanner(line);
            sc.expect('{');
            long m = 0, c = 0, ec = 0, t = 0, x = 0, n = 0;
            String s = null, e = null, h = null;
            List<Integer> l = new ArrayList<>();
            sc.skipWs();
            if (sc.peek() != '}') {
                while (true) {
                    String key = sc.readString();
                    sc.expect(':');
                    switch (key) {
                        case "m" -> m = sc.readLong();
                        case "s" -> s = sc.readString();
                        case "e" -> e = sc.readString();
                        case "h" -> h = sc.readString();
                        case "c" -> c = sc.readLong();
                        case "ec" -> ec = sc.readLong();
                        case "t" -> t = sc.readLong();
                        case "x" -> x = sc.readLong();
                        case "n" -> n = sc.readLong();
                        case "l" -> l = sc.readIntArray();
                        default -> sc.skipValue();
                    }
                    sc.skipWs();
                    if (sc.peek() == ',') {
                        sc.next();
                        sc.skipWs();
                    } else {
                        break;
                    }
                }
            }
            sc.expect('}');
            return new ReadRow(m, s, e, h, c, ec, t, x, n, l);
        }

        private static String escape(String raw) {
            StringBuilder sb = new StringBuilder(raw.length() + 8);
            for (int i = 0; i < raw.length(); i++) {
                char ch = raw.charAt(i);
                switch (ch) {
                    case '"' -> sb.append("\\\"");
                    case '\\' -> sb.append("\\\\");
                    case '\n' -> sb.append("\\n");
                    case '\r' -> sb.append("\\r");
                    case '\t' -> sb.append("\\t");
                    default -> {
                        if (ch < 0x20) {
                            sb.append(String.format("\\u%04x", (int) ch));
                        } else {
                            sb.append(ch);
                        }
                    }
                }
            }
            return sb.toString();
        }

        /** 极简游标扫描器：只服务本 schema（对象/字符串/整数/整数数组），非通用 JSON 解析器 */
        private static final class Scanner {
            private final String s;
            private int i;

            Scanner(String s) {
                this.s = s;
            }

            char peek() {
                return s.charAt(i);
            }

            char next() {
                return s.charAt(i++);
            }

            void skipWs() {
                while (i < s.length() && Character.isWhitespace(s.charAt(i))) {
                    i++;
                }
            }

            void expect(char c) {
                skipWs();
                if (i >= s.length() || s.charAt(i) != c) {
                    throw new IllegalArgumentException("JSONL 解析失败：位置 " + i + " 期望 '" + c + "'");
                }
                i++;
            }

            String readString() {
                skipWs();
                expect('"');
                StringBuilder sb = new StringBuilder();
                while (true) {
                    char ch = next();
                    if (ch == '"') {
                        return sb.toString();
                    }
                    if (ch == '\\') {
                        char esc = next();
                        sb.append(switch (esc) {
                            case 'n' -> '\n';
                            case 'r' -> '\r';
                            case 't' -> '\t';
                            case '"' -> '"';
                            case '\\' -> '\\';
                            default -> throw new IllegalArgumentException("不支持的转义：\\" + esc);
                        });
                    } else {
                        sb.append(ch);
                    }
                }
            }

            long readLong() {
                skipWs();
                int start = i;
                if (peek() == '-') {
                    i++;
                }
                while (i < s.length() && Character.isDigit(s.charAt(i))) {
                    i++;
                }
                return Long.parseLong(s.substring(start, i));
            }

            List<Integer> readIntArray() {
                skipWs();
                expect('[');
                List<Integer> out = new ArrayList<>();
                skipWs();
                if (peek() == ']') {
                    i++;
                    return out;
                }
                while (true) {
                    out.add((int) readLong());
                    skipWs();
                    char c = next();
                    if (c == ']') {
                        return out;
                    }
                    if (c != ',') {
                        throw new IllegalArgumentException("数组解析失败：位置 " + i);
                    }
                }
            }

            void skipValue() {
                skipWs();
                char c = peek();
                if (c == '"') {
                    readString();
                } else if (c == '[') {
                    readIntArray();
                } else {
                    while (i < s.length() && ",}] \t\n\r".indexOf(s.charAt(i)) < 0) {
                        i++;
                    }
                }
            }
        }
    }
}
