package com.imhgl.workbench.monitor.collector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * GitHub REST API 客户端（只读）：JDK HttpClient + Jackson 窄解析，零新增依赖。
 * <p>只取本采集器需要的两个窄形状：traffic/views 的 days[]（每日 views/uniques）与
 * releases[] 的 assets[].download_count 累计。解析函数做成包级静态以便用 fixture 单测，
 * 不发真实网络请求。
 */
@Component
public class GithubClient {

    /** 某日计数：ts 为该日 UTC 零点的毫秒时间戳（分钟对齐，直接作 ingest 的 ts） */
    public record DailyCount(long ts, long count) {
    }

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build();
    private final SourceConfigProperties properties;

    public GithubClient(SourceConfigProperties properties) {
        this.properties = properties;
    }

    /** 每日 Pages 浏览量（GitHub 限制：仅日粒度、最多回看 14 天） */
    public List<DailyCount> views(String repo) throws IOException, InterruptedException {
        return parseViews(get("/repos/" + repo + "/traffic/views"));
    }

    /** 全部 Release 资产下载次数的当前累计值（增量由采集器维护） */
    public long downloadsTotal(String repo) throws IOException, InterruptedException {
        return parseDownloadsTotal(get("/repos/" + repo + "/releases?per_page=100"));
    }

    private JsonNode get(String path) throws IOException, InterruptedException {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create("https://api.github.com" + path))
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .GET();
        // 匿名额度极低且 traffic 端点必须认证：有 token 必带；无 token 让 GitHub 401、由采集器翻译成可读提示
        if (properties.hasToken()) {
            builder.header("Authorization", "Bearer " + properties.githubToken());
        }
        HttpResponse<String> res = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) {
            throw new IOException("GitHub API " + res.statusCode());
        }
        return mapper.readTree(res.body());
    }

    /** traffic/views 响应 → 每日计数（uniques 语义不同，由调用方决定是否单独入库） */
    static List<DailyCount> parseViews(JsonNode root) {
        List<DailyCount> out = new ArrayList<>();
        for (JsonNode v : root.withArray("/views")) {
            out.add(new DailyCount(instantToMs(v.path("timestamp").asText()), v.path("count").asLong(0)));
        }
        return out;
    }

    /** releases 数组内全部资产 download_count 求和 */
    static long parseDownloadsTotal(JsonNode releases) {
        long total = 0;
        for (JsonNode release : releases) {
            for (JsonNode asset : release.withArray("/assets")) {
                total += asset.path("download_count").asLong(0);
            }
        }
        return total;
    }

    /** ISO 日期/时刻 → UTC 对齐毫秒（GitHub 日粒度数据的时间戳本身就是该日 UTC 零点） */
    static long instantToMs(String isoInstant) {
        return Instant.parse(isoInstant).toEpochMilli();
    }
}
