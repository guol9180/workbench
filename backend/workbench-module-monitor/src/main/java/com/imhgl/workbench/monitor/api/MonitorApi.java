package com.imhgl.workbench.monitor.api;

import com.imhgl.workbench.infrastructure.metrics.EndpointRank;
import com.imhgl.workbench.infrastructure.metrics.Overview;
import com.imhgl.workbench.infrastructure.metrics.RecentRecord;
import com.imhgl.workbench.infrastructure.metrics.SeriesPoint;
import com.imhgl.workbench.infrastructure.metrics.SourceStat;
import com.imhgl.workbench.monitor.dto.IngestRequest;
import com.imhgl.workbench.monitor.dto.ProbeTargetRequest;
import com.imhgl.workbench.monitor.dto.SourceConfigRequest;
import com.imhgl.workbench.monitor.model.MonitorStatus;
import com.imhgl.workbench.monitor.model.ProbeTargetView;
import com.imhgl.workbench.monitor.model.SourceCollectResult;
import com.imhgl.workbench.monitor.model.SourceConfigView;

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

    /** 时间序列；metric = count|avgMs|errCount，step = m|h；endpointFilter 可空 = 不过滤（GitHub 源按 views/downloads 拆曲线用） */
    List<SeriesPoint> series(String source, String metric, String range, String step, String endpointFilter);

    /** 端点排行；by = count|err|avgMs */
    List<EndpointRank> topEndpoints(String source, String range, int limit, String by);

    /** 最近活动记录（运行日志视图）；source 为 null/空白 = 全部来源，limit 1..500 */
    List<RecentRecord> recent(String source, int limit);

    /** 监测域自检 */
    MonitorStatus status();

    /* ---------------- 数据源配置（M6，配置页） ---------------- */

    /** 已接入的数据源列表（含采集运行状态；不含任何 token） */
    List<SourceConfigView> sourceConfigs();

    /** 接入数据源；返回生成的配置 id。同 repo 重复抛 CONFLICT，非法输入抛 PARAM_INVALID */
    String createSourceConfig(SourceConfigRequest request);

    /** 修改接入（启用停用 / 指标 / repo）；不存在抛 NOT_FOUND */
    void updateSourceConfig(String id, SourceConfigRequest request);

    /** 删除接入（停采集，历史数据按保留策略自然过期）；不存在抛 NOT_FOUND */
    void deleteSourceConfig(String id);

    /** 手动立即采集一次；结果同时回写该源的运行状态 */
    SourceCollectResult collectSourceConfig(String id);

    /** 保存页面级 GitHub token（立即生效，优先于环境变量）；空白 token 抛 PARAM_INVALID */
    void setGithubToken(String token);

    /** 清除页面级 GitHub token（回落环境变量 GITHUB_TOKEN） */
    void clearGithubToken();

    /** 当前 token 可见的仓库列表（full_name，按最近推送排序、上限 100）；未配置 token 抛 PARAM_INVALID */
    List<String> githubRepos();

    /* ---------------- 主动拨测目标（M15） ---------------- */

    /** 拨测目标列表（按创建顺序；运行状态由 series / recent 派生，不在此回写） */
    List<ProbeTargetView> probeTargets();

    /** 新增拨测目标；重名 / 同 URL 抛 CONFLICT，非法输入抛 PARAM_INVALID */
    String createProbeTarget(ProbeTargetRequest request);

    /** 修改拨测目标；不存在抛 NOT_FOUND */
    void updateProbeTarget(String id, ProbeTargetRequest request);

    /** 删除拨测目标（停拨测，历史数据按保留策略自然过期）；不存在抛 NOT_FOUND */
    void deleteProbeTarget(String id);
}
