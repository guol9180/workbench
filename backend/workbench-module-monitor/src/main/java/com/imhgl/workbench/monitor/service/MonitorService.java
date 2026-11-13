package com.imhgl.workbench.monitor.service;

import com.imhgl.workbench.infrastructure.metrics.EndpointRank;
import com.imhgl.workbench.infrastructure.metrics.Overview;
import com.imhgl.workbench.infrastructure.metrics.RecentRecord;
import com.imhgl.workbench.infrastructure.metrics.SeriesPoint;
import com.imhgl.workbench.infrastructure.metrics.SourceStat;
import com.imhgl.workbench.infrastructure.metrics.StoreStatus;
import com.imhgl.workbench.infrastructure.metrics.TimeSeriesStore;
import com.imhgl.workbench.infrastructure.metrics.TrafficRecord;
import com.imhgl.workbench.monitor.dto.IngestRequest;
import com.imhgl.workbench.monitor.model.TimeRange;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.atomic.LongAdder;

/**
 * 监测域编排服务：采集入口（自监测过滤器与上报枢纽都汇到这里）、
 * 查询编排（TimeRange → 分钟区间 → 时序存储）、背压丢弃计数。
 */
@Service
public class MonitorService {

    /** 自监测固定来源标识：本系统自身 API 流量 */
    public static final String SELF_SOURCE = "workbench";

    private final TimeSeriesStore store;
    /** 背压丢弃计数：队列满被丢的事件数（观测用，读多写少） */
    private final LongAdder dropped = new LongAdder();

    public MonitorService(TimeSeriesStore store) {
        this.store = store;
    }

    public void record(TrafficRecord record) {
        store.append(record);
    }

    /** 队列满时由过滤器调用：宁可少一条监测数据，也不阻塞业务请求 */
    public void reportDrop() {
        dropped.increment();
    }

    public long droppedEvents() {
        return dropped.sum();
    }

    /** 外部上报：点数据换算成 TrafficRecord（毫秒 ts → 分钟桶，无延迟样本） */
    public void ingest(String source, List<IngestRequest.Point> points) {
        for (IngestRequest.Point p : points) {
            store.append(new TrafficRecord(p.ts() / 60_000L, source, p.endpoint(), p.method(),
                    p.status(), p.count(), p.totalMs(), p.maxMs(), null));
        }
    }

    /**
     * 快照写入（绝对值指标）：覆盖同键桶而非累加——同一天重复采集以最后一次为准。
     * GitHub stars 这类值没有「增量」语义，走 ingest 会叠加虚高。
     */
    public void snapshot(String source, String endpoint, long value, long tsMs) {
        store.replace(new TrafficRecord(tsMs / 60_000L, source, endpoint, "GET", 200,
                (int) Math.min(value, Integer.MAX_VALUE), 0, 0, null));
    }

    public long currentMinute() {
        return System.currentTimeMillis() / 60_000L;
    }

    public List<SourceStat> sources() {
        return store.sources();
    }

    public Overview overview(String source, TimeRange range) {
        long now = currentMinute();
        return store.overview(source, range.fromMinute(now), now);
    }

    public List<SeriesPoint> series(String source, String metric, TimeRange range, String endpointFilter, boolean hourly) {
        long now = currentMinute();
        return store.series(source, metric, range.fromMinute(now), now, endpointFilter, hourly);
    }

    public List<EndpointRank> topEndpoints(String source, TimeRange range, int limit, String by) {
        long now = currentMinute();
        return store.topEndpoints(source, range.fromMinute(now), now, limit, by);
    }

    /** 最近活动记录（运行日志视图）；source 为 null/空白 = 全部来源 */
    public List<RecentRecord> recent(String source, int limit) {
        return store.recent(source, limit);
    }

    public StoreStatus storeStatus() {
        return store.status();
    }
}
