package com.imhgl.workbench;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
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
 * Token 认证集成（开启态）：无头/错值 401+40100、正确值放行、Swagger 天然放行、
 * 401 请求也被自监测计入（过滤器先于认证）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class MonitorTokenIntegrationTest {

    static final String TOKEN = "it-secret";

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) throws IOException {
        Path metricsDir = Files.createTempDirectory("workbench-metrics-t");
        Path docsDir = Files.createTempDirectory("workbench-docs-t");
        registry.add("workbench.auth.token", () -> TOKEN);
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

    private HttpResponse<String> get(String path, String token) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path));
        if (token != null) {
            b.header("X-API-Token", token);
        }
        HttpRequest request = b.method("GET", HttpRequest.BodyPublishers.noBody()).build();
        return client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    @Test
    @DisplayName("无头 → 401 + 40100")
    void missingTokenRejected() throws Exception {
        HttpResponse<String> r = get("/api/docs/tree", null);
        assertEquals(401, r.statusCode());
        assertTrue(r.body().contains("\"code\":40100"), r.body());
    }

    @Test
    @DisplayName("错值 → 401；正确值 → 放行")
    void wrongAndCorrectToken() throws Exception {
        assertEquals(401, get("/api/docs/tree", "wrong").statusCode());
        assertEquals(200, get("/api/docs/tree", TOKEN).statusCode());
    }

    @Test
    @DisplayName("monitor 域同样受保护：status 带正确 token 可访问")
    void monitorDomainProtected() throws Exception {
        assertEquals(401, get("/api/monitor/status", null).statusCode());
        assertEquals(200, get("/api/monitor/status", TOKEN).statusCode());
    }

    @Test
    @DisplayName("Swagger 不在 /api/** 内，天然放行")
    void swaggerBypasses() throws Exception {
        HttpResponse<String> r = get("/swagger-ui.html", null);
        assertTrue(r.statusCode() == 200 || r.statusCode() == 302, String.valueOf(r.statusCode()));
    }

    @Test
    @DisplayName("被 401 拒绝的请求也计入自监测（采集先于认证）")
    void rejectedRequestsAreStillMonitored() throws Exception {
        get("/api/docs/tree", null); // 401
        Thread.sleep(300); // 异步投递窗口

        String body = get("/api/monitor/overview?source=workbench&range=5m", TOKEN).body();
        assertTrue(body.contains("\"count\":"), body);
        int count = extractCount(body);
        assertTrue(count >= 1, "401 请求应被计入流量：" + body);
    }

    /** 从 JSON 里抠 count 字段（集成断言够用，不引解析库） */
    private static int extractCount(String body) {
        var m = java.util.regex.Pattern.compile("\"count\":(\\d+)").matcher(body);
        return m.find() ? Integer.parseInt(m.group(1)) : -1;
    }
}
