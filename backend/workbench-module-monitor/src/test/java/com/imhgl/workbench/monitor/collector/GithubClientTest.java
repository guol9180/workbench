package com.imhgl.workbench.monitor.collector;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** GitHub 响应窄解析：fixture 直测，不发网络请求 */
class GithubClientTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("traffic/views：views[] → 每日计数，timestamp(ISO) → 毫秒")
    void parseViews() throws Exception {
        String json = """
                {"count":42,"uniques":9,
                 "views":[{"timestamp":"2026-10-21T00:00:00Z","count":12,"uniques":5},
                          {"timestamp":"2026-10-22T00:00:00Z","count":30,"uniques":8}]}
                """;
        List<GithubClient.DailyCount> days = GithubClient.parseViews(mapper.readTree(json));
        assertEquals(2, days.size());
        long expected = LocalDate.parse("2026-10-21").atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
        assertEquals(expected, days.get(0).ts());
        assertEquals(12, days.get(0).count());
        assertEquals(30, days.get(1).count());
    }

    @Test
    @DisplayName("releases：全部资产 download_count 求和")
    void parseDownloadsTotal() throws Exception {
        String json = """
                [{"assets":[{"download_count":7},{"download_count":3}]},
                 {"assets":[]},
                 {"assets":[{"download_count":11}]}]
                """;
        assertEquals(21, GithubClient.parseDownloadsTotal(mapper.readTree(json)));
    }

    @Test
    @DisplayName("累计 → 增量：无基线记 0，正常相减，负差清零")
    void delta() {
        assertEquals(0, GithubCollector.delta(null, 100));
        assertEquals(5, GithubCollector.delta(95L, 100L));
        assertEquals(0, GithubCollector.delta(120L, 100L));
    }

    @Test
    @DisplayName("user/repos：full_name 列表，异常条目跳过")
    void parseRepoNames() throws Exception {
        String json = """
                [{"full_name":"o/a"},{"full_name":"o/b"},{"name":"broken-no-full-name"}]
                """;
        List<String> names = GithubClient.parseRepoNames(mapper.readTree(json));
        assertEquals(List.of("o/a", "o/b"), names);
    }
}
