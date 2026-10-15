package com.imhgl.workbench;

import org.junit.jupiter.api.AfterAll;
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
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 集成冒烟：v2 契约形状 / 防穿越 / 参数校验 / CORS / Swagger，全部走真实 HTTP（RANDOM_PORT）。
 * 传输层用 JDK HttpClient（Boot 4 已移除 TestRestTemplate），不跟随重定向以便断言 Swagger 的 3xx。
 * <p>设计取舍：用例按 @Order 串行共享同一存储根，后步用例自建自清（第 8 步删净），
 * 使套件结束时可整目录清理——冒烟套件追求链路完整性而非用例间零耦合。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class DocsApiIntegrationTest {

    static Path storageRoot;

    @DynamicPropertySource
    static void storageProps(DynamicPropertyRegistry registry) throws IOException {
        storageRoot = Files.createTempDirectory("workbench-docs-test");
        registry.add("workbench.storage.root", () -> storageRoot.toString());
    }

    @AfterAll
    static void cleanStorageRoot() throws IOException {
        if (storageRoot != null && Files.exists(storageRoot)) {
            // 逆序删除保证先删子项再删父项
            try (java.util.stream.Stream<Path> walk = Files.walk(storageRoot)) {
                walk.sorted(java.util.Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
            }
        }
    }

    @LocalServerPort
    int port;

    HttpClient client;

    @BeforeAll
    void setUpClient() {
        client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    }

    private String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private HttpResponse<String> send(String method, String pathAndQuery, String json) throws Exception {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + pathAndQuery));
        if (json != null) {
            builder.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8));
        } else {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        }
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private HttpResponse<String> get(String pathAndQuery) throws Exception {
        return send("GET", pathAndQuery, null);
    }

    @Test
    @Order(1)
    @DisplayName("空树：code=0 且 children 为空数组（record 序列化形状基线）")
    void treeOnFreshStorage() throws Exception {
        HttpResponse<String> r = get("/api/docs/tree");
        assertEquals(200, r.statusCode());
        String body = r.body();
        assertTrue(body.contains("\"code\":0"), body);
        assertTrue(body.contains("\"children\":[]"), body);
    }

    @Test
    @Order(2)
    @DisplayName("创建→读取：中文路径全链路")
    void createThenRead() throws Exception {
        assertEquals(200, send("POST", "/api/docs/file",
                "{\"path\":\"笔记/中文.md\",\"content\":\"# hi\"}").statusCode());
        HttpResponse<String> r = get("/api/docs/file?path=" + enc("笔记/中文.md"));
        assertEquals(200, r.statusCode());
        assertTrue(r.body().contains("\"content\":\"# hi\""), r.body());
        assertTrue(r.body().contains("\"name\":\"中文.md\""), r.body());
    }

    @Test
    @Order(3)
    @DisplayName("保存后再读生效")
    void saveThenRead() throws Exception {
        assertEquals(200, send("PUT", "/api/docs/file",
                "{\"path\":\"笔记/中文.md\",\"content\":\"# updated\"}").statusCode());
        assertTrue(get("/api/docs/file?path=" + enc("笔记/中文.md")).body().contains("\"content\":\"# updated\""));
    }

    @Test
    @Order(4)
    @DisplayName("搜索：大小写不敏感命中内容，结构化字段齐全")
    void searchHitsContent() throws Exception {
        HttpResponse<String> r = get("/api/docs/search?q=UPDATED");
        assertEquals(200, r.statusCode());
        String body = r.body();
        assertTrue(body.contains("\"path\":\"笔记/中文.md\""), body);
        assertTrue(body.contains("\"fileNameMatch\":false"), body);
        assertTrue(body.contains("\"line\":1"), body);
        assertTrue(body.contains("\"snippet\":\"# updated\""), body);
    }

    @Test
    @Order(5)
    @DisplayName("防穿越：400 + code=40000 + data 显式为 null")
    void traversalRejected() throws Exception {
        HttpResponse<String> r = get("/api/docs/file?path=" + enc("../secret.md"));
        assertEquals(400, r.statusCode());
        String body = r.body();
        assertTrue(body.contains("\"code\":40000"), body);
        assertTrue(body.contains("\"data\":null"), body);
    }

    @Test
    @Order(6)
    @DisplayName("缺参：400 + 请求参数错误")
    void missingParamRejected() throws Exception {
        HttpResponse<String> r = get("/api/docs/file");
        assertEquals(400, r.statusCode());
        String body = r.body();
        assertTrue(body.contains("请求参数错误"), body);
        assertTrue(body.contains("\"data\":null"), body);
    }

    @Test
    @Order(7)
    @DisplayName("空 path 校验失败：400 + 请求参数错误")
    void blankPathRejected() throws Exception {
        HttpResponse<String> r = send("POST", "/api/docs/file", "{\"path\":\"\",\"content\":\"x\"}");
        assertEquals(400, r.statusCode());
        assertTrue(r.body().contains("请求参数错误"), r.body());
    }

    @Test
    @Order(8)
    @DisplayName("重命名→删除→树复原")
    void renameDeleteLifecycle() throws Exception {
        assertEquals(200, send("POST", "/api/docs/rename",
                "{\"from\":\"笔记/中文.md\",\"to\":\"笔记/改名.md\"}").statusCode());
        assertTrue(get("/api/docs/file?path=" + enc("笔记/改名.md")).body().contains("\"content\":\"# updated\""));
        assertEquals(200, send("DELETE", "/api/docs/resource?path=" + enc("笔记/改名.md"), null).statusCode());
        assertTrue(get("/api/docs/tree").body().contains("\"children\":[]"));
    }

    @Test
    @Order(9)
    @DisplayName("CORS 预检：/api/** 放行外部来源，且不允许凭据")
    void corsPreflightAllowed() throws Exception {
        HttpResponse<String> r = client.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + "/api/docs/tree"))
                        .header("Origin", "http://example.com")
                        .header("Access-Control-Request-Method", "GET")
                        .method("OPTIONS", HttpRequest.BodyPublishers.noBody())
                        .build(),
                HttpResponse.BodyHandlers.ofString());
        assertEquals(200, r.statusCode());
        assertTrue(r.headers().firstValue("Access-Control-Allow-Origin").isPresent(), r.headers().toString());
        assertFalse(Boolean.parseBoolean(r.headers().firstValue("Access-Control-Allow-Credentials").orElse("false")));
    }

    @Test
    @Order(10)
    @DisplayName("未知路径 → 真实 404 + code=40400（而非兜底 500）")
    void unknownPathMapsToReal404() throws Exception {
        HttpResponse<String> r = get("/no-such-path");
        assertEquals(404, r.statusCode());
        String body = r.body();
        assertTrue(body.contains("\"code\":40400"), body);
        assertTrue(body.contains("资源不存在"), body);
    }

    @Test
    @Order(11)
    @DisplayName("Swagger UI 可打开（默认开启，302 指向 /swagger-ui/index.html）")
    void swaggerUiAvailable() throws Exception {
        HttpResponse<String> r = get("/swagger-ui.html");
        assertTrue(r.statusCode() == 200 || r.statusCode() == 302, String.valueOf(r.statusCode()));
    }
}
