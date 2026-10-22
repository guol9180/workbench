package com.imhgl.workbench.monitor.api;

import com.imhgl.workbench.infrastructure.metrics.EndpointRank;
import com.imhgl.workbench.infrastructure.metrics.Overview;
import com.imhgl.workbench.infrastructure.metrics.SeriesPoint;
import com.imhgl.workbench.infrastructure.metrics.SourceStat;
import com.imhgl.workbench.monitor.dto.IngestRequest;
import com.imhgl.workbench.monitor.model.MonitorStatus;

import java.util.List;

/**
 * 流量监测模块对外契约：其他模块（及本模块 controller）访问监测能力的唯一入口。
 * 边界收 String（range/step），内部经 TimeRange 值对象校验；非法值抛
 * IllegalArgumentException 由全局异常处理器映射为 400。
 * <p>出参直接采用 infrastructure 的中性查询模型（SourceStat/Overview/SeriesPoint/EndpointRank）——
 * 对监测域而言这些形状本身就是业务契约，且不含任何技术设施细节，无需再包一层同形 record。
 */
public interface MonitorApi {

    /** 外部系统上报：批量聚合点写入时序存储 */
    void ingest(IngestRequest request);

    /** 已知来源 + 最近活跃分钟（含自监测来源 workbench） */
    List<SourceStat> sources();

    /** 区间总览；range = 5m|1h|6h|24h|7d */
    Overview overview(String source, String range);

    /** 时间序列；metric = count|avgMs|errCount，step = m|h */
    List<SeriesPoint> series(String source, String metric, String range, String step);

    /** 端点排行；by = count|err|avgMs */
    List<EndpointRank> topEndpoints(String source, String range, int limit, String by);

    /** 监测域自检 */
    MonitorStatus status();
}
