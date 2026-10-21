package com.imhgl.workbench.infrastructure.metrics;

import java.util.List;

/**
 * 中性时序存储契约：流量记录的追加与查询（规范见 AGENTS.md 3.3）。
 * <p>接口只收 epoch 分钟数（不携带任何业务侧的时间语义），保持技术设施中性；
 * 业务模块（monitor）负责把 TimeRange 这类值对象翻译成分钟区间传入。
 * 查询返回的是内存桶的近似视图（最终一致），对监测场景足够。
 */
public interface TimeSeriesStore extends AutoCloseable {

    /** 追加一条聚合增量；线程安全，永不阻塞调用方 */
    void append(TrafficRecord record);

    /** 已知来源列表（含最近活跃分钟） */
    List<SourceStat> sources();

    /** 区间总览（含 p95：无延迟样本时回退 maxMs 近似） */
    Overview overview(String source, long fromMinute, long toMinute);

    /**
     * 时间序列：按分钟或整小时步长聚合。
     *
     * @param metric count | avgMs | errCount 之一，非法值抛 IllegalArgumentException
     * @param hourly true = 小时步长（bucketEpoch 为整小时对齐的分钟值）
     */
    List<SeriesPoint> series(String source, String metric, long fromMinute, long toMinute, boolean hourly);

    /**
     * 端点排行。
     *
     * @param by    count | err | avgMs 之一，按该维度降序
     * @param limit 最多返回条数
     */
    List<EndpointRank> topEndpoints(String source, long fromMinute, long toMinute, int limit, String by);

    /** 把脏桶快照落盘（定时任务也会调用；测试与停机前显式调用） */
    void flush();

    /** 存储自检：内存桶数与数据文件数（供 /api/monitor/status） */
    StoreStatus status();

    @Override
    void close();
}
