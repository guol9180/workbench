package com.imhgl.workbench.monitor.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * TimeRange 值对象：区间标签解析与校验的唯一入口，非法值造不出实例。
 */
class TimeRangeTest {

    @Test
    @DisplayName("合法标签：五种预设区间与秒数一一对应")
    void parsesAllowedLabels() {
        assertEquals(300L, TimeRange.of("5m").seconds());
        assertEquals(3_600L, TimeRange.of("1h").seconds());
        assertEquals(21_600L, TimeRange.of("6h").seconds());
        assertEquals(86_400L, TimeRange.of("24h").seconds());
        assertEquals(604_800L, TimeRange.of("7d").seconds());
        assertEquals("24h", TimeRange.of("24h").label());
    }

    @Test
    @DisplayName("fromMinute：区间起点 = 当前分钟往前推整秒数对应的分钟")
    void computesFromMinute() {
        TimeRange r = TimeRange.of("1h");
        assertEquals(10_000L - 60, r.fromMinute(10_000L));
    }

    @Test
    @DisplayName("非法标签拒绝：空、null、未预设的粒度（3h/1d/1w）、大小写敏感")
    void rejectsIllegalLabels() {
        for (String bad : new String[]{null, "", "  ", "3h", "1d", "1w", "1H", "60m", "7dd"}) {
            assertThrows(IllegalArgumentException.class, () -> TimeRange.of(bad), "应拒绝：" + bad);
        }
    }
}
