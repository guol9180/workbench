package com.imhgl.workbench.monitor.collector;

import java.util.List;

/**
 * 数据源配置（源配置页的持久化单元）。
 * <p>id 由 repo 归一生成（gh-{owner}-{repo}，小写），保证同一仓库重复接入在 id 层面也可判定；
 * lastOkAt/lastError 是采集器的运行状态回写；lastDay 是 pages 指标的已采日期游标（ISO yyyy-MM-dd）——
 * GitHub 给的是每日绝对值，聚合桶的语义是叠加，靠游标只采严格更新的日期来保证幂等（重启不丢，随配置持久化）。
 * token 不落盘也不出现在本记录（只从环境变量读取）。
 */
public record SourceConfig(
        String id,
        String type,
        String repo,
        boolean enabled,
        List<String> metrics,
        long createdAt,
        Long lastOkAt,
        String lastError,
        String lastDay) {

    /** 采集回写后的新实例（record 不可变，状态更新走拷贝；lastDay 传 null 表示维持原值）。
     * 注意 Long 分支：三元里混用 primitive long 会把 null 拆箱炸掉，这里显式装箱 */
    public SourceConfig withResult(Long lastOkAt, String lastError, String lastDay) {
        Long nextOk = lastOkAt != null ? Long.valueOf(lastOkAt) : this.lastOkAt;
        return new SourceConfig(id, type, repo, enabled, metrics, createdAt,
                nextOk, lastError, lastDay != null ? lastDay : this.lastDay);
    }
}
