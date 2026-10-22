package com.imhgl.workbench;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 监测域集成（认证关闭态）：自监测链路、外部上报枢纽、非法区间 400、自检。
 * 与 DocsApiIntegrationTest 同法：JDK HttpClient + RANDOM_PORT + 临时存储目录。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class MonitorIntegrationTest {

    static Path metricsDir;
    static Path docsDir;

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) throws IOException {
        metricsDir = Files.createTempDirectory("workbench-metrics-test");
        docsDir = Files.createTempDirectory("workbench-docs-test");
        registry.add("workbench.metrics.data-dir", () -> metricsDir.toString());
        registry.add("workbench.storage.root", () -> docsDir.toString());
    }

    @LocalServerPort
    int port;

    HttpClient client;

    @BeforeAll
    void setUpClient() {
        client = HttpClient.newHttpClient();
    }

    private HttpResponse<String> send(String method, String pathAndQuery, String json) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + pathAndQuery));
        if (json != null) {
            b.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8));
        } else {
            b.method(method, HttpRequest.BodyPublishers.noBody());
        }
        return client.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private HttpResponse<String> get(String pathAndQuery) throws Exception {
        return send("GET", pathAndQuery, null);
    }

    @Test
    @Order(1)
    @DisplayName("自监测链路：调 docs API 后 workbench 来源计数增长、端点为归一化路径")
    void selfMonitoringRecordsDocsTraffic() throws Exception {
        assertEquals(200, get("/api/docs/tree").statusCode());

        // 异步投递：轮询等待 overview 出现 workbench 流量
        String body = "";
        long deadline = System.currentTimeMillis() + 8_000;
        while (System.currentTimeMillis() < deadline) {
            body = get("/api/monitor/overview?source=workbench&range=5m").body();
            if (body.contains("\"count\":1")) {
                break;
            }
            Thread.sleep(100);
        }
        assertTrue(body.contains("\"count\":1"), "自监测应记录 1 次 /api/docs/tree 调用：" + body);
        assertTrue(body.contains("\"rps\":"));
        // 自身这条 overview 请求也会被记录——top 端点至少含归一化后的两个端点之一
        String top = get("/api/monitor/top-endpoints?source=workbench&range=5m&limit=5&by=count").body();
        assertTrue(top.contains("/api/docs/tree") || top.contains("/api/monitor/overview"), top);
    }

    @Test
    @Order(2)
    @DisplayName("上报枢纽：外部来源 ingest 后 sources/series/top-endpoints 正确反映")
    void ingestHubReflectsExternalSource() throws Exception {
        long now = System.currentTimeMillis();
        String payload = "{\"source\":\"nginx\",\"points\":["
                + "{\"endpoint\":\"/up\",\"method\":\"GET\",\"status\":200,\"count\":5,\"totalMs\":250,\"maxMs\":90,\"ts\":" + now + "},"
                + "{\"endpoint\":\"/up\",\"method\":\"GET\",\"status\":500,\"count\":2,\"totalMs\":80,\"maxMs\":50,\"ts\":" + now + "}"
                + "]}";
        assertEquals(200, send("POST", "/api/monitor/ingest", payload).statusCode());

        assertTrue(get("/api/monitor/sources").body().contains("\"name\":\"nginx\""), "来源列表应含 nginx");
        String series = get("/api/monitor/series?source=nginx&metric=count&range=5m&step=m").body();
        assertTrue(series.contains("\"value\":7"), "nginx 总量应为 7：" + series);
        String overview = get("/api/monitor/overview?source=nginx&range=5m").body();
        assertTrue(overview.contains("\"errCount\":2"), overview);
    }

    @Test
    @Order(3)
    @DisplayName("非法 range → 400 + 40000；非法 step → 400")
    void illegalQueryParamsRejected() throws Exception {
        HttpResponse<String> r1 = get("/api/monitor/overview?source=x&range=3h");
        assertEquals(400, r1.statusCode());
        assertTrue(r1.body().contains("\"code\":40000"), r1.body());

        HttpResponse<String> r2 = get("/api/monitor/series?source=x&metric=count&range=1h&step=x");
        assertEquals(400, r2.statusCode());
    }

    @Test
    @Order(4)
    @DisplayName("status 自检：含存储规模、认证开关（关）、丢弃计数")
    void statusShape() throws Exception {
        String body = get("/api/monitor/status").body();
        assertTrue(body.contains("\"authEnabled\":false"), body);
        assertTrue(body.contains("\"memoryBuckets\":"), body);
        assertTrue(body.contains("\"droppedEvents\":0"), body);
    }
}
