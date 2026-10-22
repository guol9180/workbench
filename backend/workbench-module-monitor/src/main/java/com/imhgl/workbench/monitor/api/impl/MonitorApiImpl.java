package com.imhgl.workbench.monitor.api.impl;

import com.imhgl.workbench.framework.config.ApiTokenProperties;
import com.imhgl.workbench.infrastructure.metrics.EndpointRank;
import com.imhgl.workbench.infrastructure.metrics.Overview;
import com.imhgl.workbench.infrastructure.metrics.SeriesPoint;
import com.imhgl.workbench.infrastructure.metrics.SourceStat;
import com.imhgl.workbench.monitor.api.MonitorApi;
import com.imhgl.workbench.monitor.dto.IngestRequest;
import com.imhgl.workbench.monitor.model.MonitorStatus;
import com.imhgl.workbench.monitor.model.TimeRange;
import com.imhgl.workbench.monitor.service.MonitorService;
import com.imhgl.workbench.infrastructure.metrics.StoreStatus;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * MonitorApi 实现：字符串边界 → 值对象校验（TimeRange / step / by）→ 服务编排。
 * 自检出参额外聚合认证开关与背压丢弃计数，方便一台仪表盘看健康度。
 */
@Service
public class MonitorApiImpl implements MonitorApi {

    private final MonitorService service;
    private final ApiTokenProperties authProperties;

    public MonitorApiImpl(MonitorService service, ApiTokenProperties authProperties) {
        this.service = service;
        this.authProperties = authProperties;
    }

    @Override
    public void ingest(IngestRequest request) {
        service.ingest(request.source(), request.points());
    }

    @Override
    public List<SourceStat> sources() {
        return service.sources();
    }

    @Override
    public Overview overview(String source, String range) {
        return service.overview(source, TimeRange.of(range));
    }

    @Override
    public List<SeriesPoint> series(String source, String metric, String range, String step) {
        boolean hourly = switch (step == null ? "" : step) {
            case "m" -> false;
            case "h" -> true;
            default -> throw new IllegalArgumentException("非法步长：" + step + "（可选 m/h）");
        };
        return service.series(source, metric, TimeRange.of(range), hourly);
    }

    @Override
    public List<EndpointRank> topEndpoints(String source, String range, int limit, String by) {
        return service.topEndpoints(source, TimeRange.of(range), limit, by);
    }

    @Override
    public MonitorStatus status() {
        StoreStatus storeStatus = service.storeStatus();
        boolean authEnabled = authProperties.token() != null && !authProperties.token().isBlank();
        return new MonitorStatus(storeStatus.memoryBuckets(), storeStatus.dataFiles(),
                authEnabled, service.droppedEvents());
    }
}
