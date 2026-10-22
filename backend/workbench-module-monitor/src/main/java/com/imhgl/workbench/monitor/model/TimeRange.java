package com.imhgl.workbench.monitor.model;

import java.util.Map;

/**
 * 查询区间值对象：预设标签（5m/1h/6h/24h/7d）的解析与校验唯一入口，非法值造不出实例
 * （呼应 DocPath 的值对象约定，AGENTS.md 3.5）。
 * <p>只开放固定档位而非任意时长：管理台图表的粒度是设计出来的，不是算出来的——
 * 档位有限才能保证 step 与 range 的组合永远合理。
 */
public record TimeRange(String label, long seconds) {

    private static final Map<String, Long> ALLOWED = Map.of(
            "5m", 300L,
            "1h", 3_600L,
            "6h", 21_600L,
            "24h", 86_400L,
            "7d", 604_800L);

    public static TimeRange of(String raw) {
        if (raw == null || !ALLOWED.containsKey(raw)) {
            throw new IllegalArgumentException("非法查询区间：" + raw + "（可选 5m/1h/6h/24h/7d）");
        }
        return new TimeRange(raw, ALLOWED.get(raw));
    }

    /** 区间起点分钟（含）：now 往前推——所有档位的秒数都是 60 的整数倍，分钟粒度无损 */
    public long fromMinute(long nowMinute) {
        return nowMinute - seconds / 60;
    }
}
