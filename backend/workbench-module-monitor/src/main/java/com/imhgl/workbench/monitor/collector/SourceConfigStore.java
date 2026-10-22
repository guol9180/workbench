package com.imhgl.workbench.monitor.collector;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.imhgl.workbench.common.exception.BusinessException;
import com.imhgl.workbench.common.exception.ErrorCode;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * 源配置的 JSON 文件存储（data/sources.json）：进程内独占读写，外部没人改。
 * <p>写路径走「临时文件 + 原子移动」，断电也不会留半个 JSON；record 列表整体重写——
 * 配置量级是个位数仓库，整写比增量补丁简单且足够快。
 * <p>业务冲突（重复 repo / id 不存在）直接抛 BusinessException：本类只在 monitor 模块内使用，
 * 不跨模块，无需中性异常那层翻译。
 */
@Component
public class SourceConfigStore {

    private final Path file;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Object lock = new Object();

    public SourceConfigStore(SourceConfigProperties properties) {
        this.file = Path.of(properties.file());
    }

    /** 全量配置；文件不存在视为空列表（首次启动） */
    public List<SourceConfig> list() {
        synchronized (lock) {
            return readAll();
        }
    }

    /** 新增接入：同 repo（忽略大小写）重复抛 CONFLICT；id 由 repo 归一生成 */
    public SourceConfig create(String type, String repo, boolean enabled, List<String> metrics) {
        synchronized (lock) {
            List<SourceConfig> all = readAll();
            String id = idOf(repo);
            ensureRepoFree(all, id);
            SourceConfig config = new SourceConfig(id, type, repo, enabled, metrics, System.currentTimeMillis(), null, null, null);
            all.add(config);
            writeAll(all);
            return config;
        }
    }

    /** 更新（repo 变更时同样查重，但不允许把 repo 改成另一个已接入仓库）；不存在抛 NOT_FOUND */
    public SourceConfig update(String id, String type, String repo, boolean enabled, List<String> metrics) {
        synchronized (lock) {
            List<SourceConfig> all = readAll();
            ensureExists(all, id);
            ensureRepoFree(all, idOf(repo));
            List<SourceConfig> next = new ArrayList<>();
            for (SourceConfig c : all) {
                // repo 未变时保留 lastDay 游标；换了 repo 则游标作废重新起算
                boolean sameRepo = c.repo().equalsIgnoreCase(repo);
                next.add(c.id().equals(id)
                        ? new SourceConfig(id, type, repo, enabled, metrics, c.createdAt(),
                                c.lastOkAt(), c.lastError(), sameRepo ? c.lastDay() : null)
                        : c);
            }
            writeAll(next);
            return findIn(next, id).orElseThrow();
        }
    }

    /** 删除（停采集，历史数据按保留策略自然过期）；不存在抛 NOT_FOUND */
    public void delete(String id) {
        synchronized (lock) {
            List<SourceConfig> all = readAll();
            ensureExists(all, id);
            writeAll(all.stream().filter(c -> !c.id().equals(id)).toList());
        }
    }

    /** 按 id 查找；不存在抛 NOT_FOUND（api 层与采集器共用） */
    public SourceConfig require(String id) {
        synchronized (lock) {
            return findIn(readAll(), id).orElseThrow(() -> notFound(id));
        }
    }

    /**
     * 采集结果回写（成功时间 / 最近错误 / pages 游标），与配置同一文件持久化。
     * lastDay 传 null 表示维持原值；成功清错误、失败保留原成功时间——错误只留最近一条，避免文件膨胀。
     */
    public void markResult(String id, boolean ok, String error, String lastDay) {
        synchronized (lock) {
            List<SourceConfig> all = readAll();
            List<SourceConfig> next = new ArrayList<>();
            for (SourceConfig c : all) {
                next.add(c.id().equals(id)
                        ? c.withResult(ok ? Long.valueOf(System.currentTimeMillis()) : c.lastOkAt(),
                                ok ? null : error, lastDay)
                        : c);
            }
            writeAll(next);
        }
    }

    private List<SourceConfig> readAll() {
        if (!Files.exists(file)) {
            return new ArrayList<>();
        }
        try {
            ArrayNode sources = (ArrayNode) mapper.readTree(file.toFile()).withArray("/sources");
            List<SourceConfig> all = new ArrayList<>();
            for (int i = 0; i < sources.size(); i++) {
                ObjectNode n = (ObjectNode) sources.get(i);
                List<String> metrics = new ArrayList<>();
                n.withArray("/metrics").forEach(m -> metrics.add(m.asText()));
                all.add(new SourceConfig(
                        n.path("id").asText(),
                        n.path("type").asText(),
                        n.path("repo").asText(),
                        n.path("enabled").asBoolean(true),
                        metrics,
                        n.path("createdAt").asLong(0),
                        n.hasNonNull("lastOkAt") ? n.get("lastOkAt").asLong() : null,
                        n.hasNonNull("lastError") ? n.get("lastError").asText() : null,
                        n.hasNonNull("lastDay") ? n.get("lastDay").asText() : null));
            }
            return all;
        } catch (IOException e) {
            throw new UncheckedIOException("源配置文件读取失败：" + file, e);
        }
    }

    private void writeAll(List<SourceConfig> all) {
        ObjectNode root = mapper.createObjectNode();
        root.put("version", 1);
        ArrayNode sources = root.withArray("/sources");
        for (SourceConfig c : all) {
            ObjectNode n = sources.addObject();
            n.put("id", c.id());
            n.put("type", c.type());
            n.put("repo", c.repo());
            n.put("enabled", c.enabled());
            ArrayNode metrics = n.withArray("/metrics");
            c.metrics().forEach(metrics::add);
            n.put("createdAt", c.createdAt());
            if (c.lastOkAt() != null) n.put("lastOkAt", c.lastOkAt());
            if (c.lastError() != null) n.put("lastError", c.lastError());
            if (c.lastDay() != null) n.put("lastDay", c.lastDay());
        }
        try {
            Files.createDirectories(file.getParent());
            Path tmp = file.resolveSibling(file.getFileName() + ".tmp");
            Files.writeString(tmp, mapper.writerWithDefaultPrettyPrinter().writeValueAsString(root));
            Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException e) {
            throw new UncheckedIOException("源配置文件写入失败：" + file, e);
        }
    }

    /** id = gh-{owner}-{repo}（小写归一）：与「同 repo 不得重复」天然对齐 */
    static String idOf(String repo) {
        return "gh-" + repo.toLowerCase(Locale.ROOT).replace('/', '-').replace('_', '-');
    }

    private static void ensureRepoFree(List<SourceConfig> all, String candidateId) {
        for (SourceConfig c : all) {
            if (c.id().equals(candidateId)) {
                throw new BusinessException(ErrorCode.CONFLICT, "仓库已接入（id：" + candidateId + "）");
            }
        }
    }

    private static void ensureExists(List<SourceConfig> all, String id) {
        if (findIn(all, id).isEmpty()) {
            throw notFound(id);
        }
    }

    private static Optional<SourceConfig> findIn(List<SourceConfig> all, String id) {
        return all.stream().filter(c -> c.id().equals(id)).findFirst();
    }

    private static BusinessException notFound(String id) {
        return new BusinessException(ErrorCode.NOT_FOUND, "数据源不存在：" + id);
    }
}
