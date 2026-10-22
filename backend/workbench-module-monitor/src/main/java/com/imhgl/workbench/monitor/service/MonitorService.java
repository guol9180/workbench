package com.imhgl.workbench.monitor.service;

import com.imhgl.workbench.infrastructure.metrics.EndpointRank;
import com.imhgl.workbench.infrastructure.metrics.Overview;
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

    public List<SeriesPoint> series(String source, String metric, TimeRange range, boolean hourly) {
        long now = currentMinute();
        return store.series(source, metric, range.fromMinute(now), now, hourly);
    }

    public List<EndpointRank> topEndpoints(String source, TimeRange range, int limit, String by) {
        long now = currentMinute();
        return store.topEndpoints(source, range.fromMinute(now), now, limit, by);
    }

    public StoreStatus storeStatus() {
        return store.status();
    }
}
