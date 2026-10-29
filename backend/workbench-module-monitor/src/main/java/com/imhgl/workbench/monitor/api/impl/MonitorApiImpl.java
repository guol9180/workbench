package com.imhgl.workbench.monitor.api.impl;

import com.imhgl.workbench.common.exception.BusinessException;
import com.imhgl.workbench.common.exception.ErrorCode;
import com.imhgl.workbench.framework.config.AuthProperties;
import com.imhgl.workbench.infrastructure.metrics.EndpointRank;
import com.imhgl.workbench.infrastructure.metrics.Overview;
import com.imhgl.workbench.infrastructure.metrics.SeriesPoint;
import com.imhgl.workbench.infrastructure.metrics.SourceStat;
import com.imhgl.workbench.monitor.api.MonitorApi;
import com.imhgl.workbench.monitor.collector.GithubClient;
import com.imhgl.workbench.monitor.collector.GithubCollector;
import com.imhgl.workbench.monitor.collector.GithubTokenProvider;
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
import java.io.IOException;

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
    private final AuthProperties authProperties;
    private final SourceConfigStore sourceConfigStore;
    private final GithubCollector githubCollector;
    private final GithubTokenProvider tokenProvider;
    private final GithubClient githubClient;

    public MonitorApiImpl(MonitorService service, AuthProperties authProperties,
                          SourceConfigStore sourceConfigStore, GithubCollector githubCollector,
                          GithubTokenProvider tokenProvider, GithubClient githubClient) {
        this.service = service;
        this.authProperties = authProperties;
        this.sourceConfigStore = sourceConfigStore;
        this.githubCollector = githubCollector;
        this.tokenProvider = tokenProvider;
        this.githubClient = githubClient;
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
    public List<SeriesPoint> series(String source, String metric, String range, String step, String endpointFilter) {
        boolean hourly = switch (step == null ? "" : step) {
            case "m" -> false;
            case "h" -> true;
            default -> throw new IllegalArgumentException("非法步长：" + step + "（可选 m/h）");
        };
        return service.series(source, metric, TimeRange.of(range), endpointFilter, hourly);
    }

    @Override
    public List<EndpointRank> topEndpoints(String source, String range, int limit, String by) {
        return service.topEndpoints(source, TimeRange.of(range), limit, by);
    }

    @Override
    public MonitorStatus status() {
        StoreStatus storeStatus = service.storeStatus();
        boolean authEnabled = authProperties.enabled();
        // GitHub token 只暴露「配没配 + 来源（page/env）」：配置页据此渲染就绪态或引导条
        boolean tokenReady = tokenProvider.hasToken();
        return new MonitorStatus(storeStatus.memoryBuckets(), storeStatus.dataFiles(),
                authEnabled, service.droppedEvents(), tokenReady, tokenProvider.source());
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

    @Override
    public void setGithubToken(String token) {
        if (token == null || token.isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_INVALID, "token 不能为空");
        }
        tokenProvider.setPageToken(token);
    }

    @Override
    public void clearGithubToken() {
        tokenProvider.clearPageToken();
    }

    @Override
    public List<String> githubRepos() {
        // 前端在 token 未就绪时不该发起此请求；这里兜底拦截并给出明确的下一步指引
        if (!tokenProvider.hasToken()) {
            throw new BusinessException(ErrorCode.PARAM_INVALID, "请先配置 GitHub 令牌，再拉取仓库列表");
        }
        try {
            return githubClient.listRepos();
        } catch (IOException | InterruptedException e) {
            // 细节不对前端暴露（网络/权限语义复杂），统一给可操作的失败提示
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "拉取仓库列表失败——请检查令牌有效性后重试");
        }
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
