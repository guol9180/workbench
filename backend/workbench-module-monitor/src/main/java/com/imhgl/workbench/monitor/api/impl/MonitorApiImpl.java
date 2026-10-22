package com.imhgl.workbench.monitor.api.impl;

import com.imhgl.workbench.common.exception.BusinessException;
import com.imhgl.workbench.common.exception.ErrorCode;
import com.imhgl.workbench.framework.config.ApiTokenProperties;
import com.imhgl.workbench.infrastructure.metrics.EndpointRank;
import com.imhgl.workbench.infrastructure.metrics.Overview;
import com.imhgl.workbench.infrastructure.metrics.SeriesPoint;
import com.imhgl.workbench.infrastructure.metrics.SourceStat;
import com.imhgl.workbench.monitor.api.MonitorApi;
import com.imhgl.workbench.monitor.collector.GithubCollector;
import com.imhgl.workbench.monitor.collector.SourceConfigStore;
import com.imhgl.workbench.monitor.dto.IngestRequest;
import com.imhgl.workbench.monitor.dto.SourceConfigRequest;
import com.imhgl.workbench.monitor.model.MonitorStatus;
import com.imhgl.workbench.monitor.model.SourceCollectResult;
import com.imhgl.workbench.monitor.model.SourceConfigView;
import com.imhgl.workbench.monitor.model.TimeRange;
import com.imhgl.workbench.monitor.service.MonitorService;
import com.imhgl.workbench.infrastructure.metrics.StoreStatus;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

/**
 * MonitorApi 实现：字符串边界 → 值对象校验（TimeRange / step / by）→ 服务编排。
 * 自检出参额外聚合认证开关与背压丢弃计数，方便一台仪表盘看健康度。
 * <p>源配置管理（M6）：DTO 正则拦形状，api 层拦语义（type/metrics 白名单）；
 * store 与 collector 都只在本模块内，直接以业务异常对话，无需中性异常翻译。
 */
@Service
public class MonitorApiImpl implements MonitorApi {

    private static final Set<String> SUPPORTED_TYPES = Set.of("github");
    private static final Set<String> SUPPORTED_METRICS = Set.of("pages", "downloads");

    private final MonitorService service;
    private final ApiTokenProperties authProperties;
    private final SourceConfigStore sourceConfigStore;
    private final GithubCollector githubCollector;

    public MonitorApiImpl(MonitorService service, ApiTokenProperties authProperties,
                          SourceConfigStore sourceConfigStore, GithubCollector githubCollector) {
        this.service = service;
        this.authProperties = authProperties;
        this.sourceConfigStore = sourceConfigStore;
        this.githubCollector = githubCollector;
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

    /* ---------------- 数据源配置（M6） ---------------- */

    @Override
    public List<SourceConfigView> sourceConfigs() {
        return sourceConfigStore.list().stream()
                .map(c -> new SourceConfigView(c.id(), c.type(), c.repo(), c.enabled(),
                        c.metrics(), c.createdAt(), c.lastOkAt(), c.lastError(), c.lastDay()))
                .toList();
    }

    @Override
    public String createSourceConfig(SourceConfigRequest request) {
        validate(request);
        return sourceConfigStore.create(request.type(), request.repo(), request.enabled(), request.metrics()).id();
    }

    @Override
    public void updateSourceConfig(String id, SourceConfigRequest request) {
        validate(request);
        sourceConfigStore.update(id, request.type(), request.repo(), request.enabled(), request.metrics());
    }

    @Override
    public void deleteSourceConfig(String id) {
        sourceConfigStore.delete(id);
    }

    @Override
    public SourceCollectResult collectSourceConfig(String id) {
        GithubCollector.CollectOutcome outcome = githubCollector.collectNow(id);
        return new SourceCollectResult(outcome.ok(), outcome.error());
    }

    private static void validate(SourceConfigRequest request) {
        if (!SUPPORTED_TYPES.contains(request.type())) {
            throw new BusinessException(ErrorCode.PARAM_INVALID, "暂不支持的数据源类型：" + request.type());
        }
        for (String metric : request.metrics()) {
            if (!SUPPORTED_METRICS.contains(metric)) {
                throw new BusinessException(ErrorCode.PARAM_INVALID, "暂不支持的指标：" + metric);
            }
        }
    }
}
