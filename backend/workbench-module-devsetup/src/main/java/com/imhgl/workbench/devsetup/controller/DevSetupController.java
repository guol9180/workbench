package com.imhgl.workbench.devsetup.controller;

import com.imhgl.workbench.common.result.ApiResult;
import com.imhgl.workbench.devsetup.api.DevSetupApi;
import com.imhgl.workbench.devsetup.dto.SetupConfigFileRequest;
import com.imhgl.workbench.devsetup.dto.SetupToolRequest;
import com.imhgl.workbench.devsetup.model.SetupArtifact;
import com.imhgl.workbench.devsetup.model.SetupConfigFile;
import com.imhgl.workbench.devsetup.model.SetupConfigFileContent;
import com.imhgl.workbench.devsetup.model.SetupManifest;
import com.imhgl.workbench.devsetup.model.SetupTool;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * 开发环境管家接口（/api/devsetup/**）。
 * 业务端点统一走 ApiResult；两个 .ps1 脚本端点返回原始文本
 * （CRLF + UTF-8 BOM，兼容 PowerShell 5.1 中文与「irm | iex」管道执行）。
 */
@RestController
@RequestMapping("/api/devsetup")
public class DevSetupController {

    private final DevSetupApi devSetupApi;

    public DevSetupController(DevSetupApi devSetupApi) {
        this.devSetupApi = devSetupApi;
    }

    // ---------- 工具清单 ----------

    @GetMapping("/tools")
    public ApiResult<List<SetupTool>> tools() {
        return ApiResult.ok(devSetupApi.listTools());
    }

    @PostMapping("/tools")
    public ApiResult<Void> createTool(@RequestBody SetupToolRequest request) {
        devSetupApi.createTool(request);
        return ApiResult.ok();
    }

    @PutMapping("/tools/{id}")
    public ApiResult<Void> updateTool(@PathVariable("id") Long id, @RequestBody SetupToolRequest request) {
        devSetupApi.updateTool(id, request);
        return ApiResult.ok();
    }

    @DeleteMapping("/tools/{id}")
    public ApiResult<Void> deleteTool(@PathVariable("id") Long id) {
        devSetupApi.deleteTool(id);
        return ApiResult.ok();
    }

    // ---------- 配置文件 ----------

    @GetMapping("/config-files")
    public ApiResult<List<SetupConfigFile>> configFiles() {
        return ApiResult.ok(devSetupApi.listConfigFiles());
    }

    @GetMapping("/config-files/{id}")
    public ApiResult<SetupConfigFileContent> configFile(@PathVariable("id") Long id) {
        return ApiResult.ok(devSetupApi.getConfigFile(id));
    }

    @PostMapping("/config-files")
    public ApiResult<Void> createConfigFile(@RequestBody SetupConfigFileRequest request) {
        devSetupApi.createConfigFile(request);
        return ApiResult.ok();
    }

    @PutMapping("/config-files/{id}")
    public ApiResult<Void> updateConfigFile(@PathVariable("id") Long id, @RequestBody SetupConfigFileRequest request) {
        devSetupApi.updateConfigFile(id, request);
        return ApiResult.ok();
    }

    @DeleteMapping("/config-files/{id}")
    public ApiResult<Void> deleteConfigFile(@PathVariable("id") Long id) {
        devSetupApi.deleteConfigFile(id);
        return ApiResult.ok();
    }

    // ---------- 二进制工件（IDEA 配置快照） ----------

    @GetMapping("/artifacts")
    public ApiResult<List<SetupArtifact>> artifacts() {
        return ApiResult.ok(devSetupApi.listArtifacts());
    }

    @PostMapping(value = "/artifacts", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResult<Void> uploadArtifact(@RequestParam("name") String name,
                                          @RequestParam(value = "note", required = false) String note,
                                          @RequestParam("file") MultipartFile file) {
        devSetupApi.saveArtifact(name, note, file);
        return ApiResult.ok();
    }

    /** 302 跳转到 OSS 预签名 URL：文件流量直达 OSS，不占服务器带宽；
     *  Invoke-WebRequest（引导脚本）与 fetch（前端）默认跟随重定向 */
    @GetMapping("/artifacts/{name}/download")
    public ResponseEntity<Void> downloadArtifact(@PathVariable("name") String name) {
        String url = devSetupApi.artifactDownloadUrl(name);
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, url)
                .build();
    }

    @DeleteMapping("/artifacts/{name}")
    public ApiResult<Void> deleteArtifact(@PathVariable("name") String name) {
        devSetupApi.deleteArtifact(name);
        return ApiResult.ok();
    }

    // ---------- 清单与引导脚本 ----------

    @GetMapping("/manifest")
    public ApiResult<SetupManifest> manifest() {
        return ApiResult.ok(devSetupApi.manifest());
    }

    @GetMapping("/bootstrap.ps1")
    public ResponseEntity<byte[]> bootstrap(HttpServletRequest request) {
        return scriptResponse("bootstrap.ps1", devSetupApi.bootstrapScript(baseUrl(request)));
    }

    @GetMapping("/capture.ps1")
    public ResponseEntity<byte[]> capture() {
        return scriptResponse("capture.ps1", devSetupApi.captureScript());
    }

    /** 脚本文本 → CRLF + UTF-8 BOM 字节（PowerShell 5.1 中文脚本要求 BOM） */
    private ResponseEntity<byte[]> scriptResponse(String filename, String script) {
        byte[] body = ("\uFEFF" + script.replace("\n", "\r\n")).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.status(HttpStatus.OK)
                .header(HttpHeaders.CONTENT_TYPE, "text/plain;charset=UTF-8")
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .body(body);
    }

    /** 服务地址：优先反向代理头（Caddy 保留 Host、传递 X-Forwarded-Proto），否则取请求自身 */
    private String baseUrl(HttpServletRequest request) {
        String proto = request.getHeader("X-Forwarded-Proto");
        if (proto == null || proto.isBlank()) {
            proto = request.getScheme();
        }
        String host = request.getHeader("Host");
        if (host == null || host.isBlank()) {
            host = request.getServerName() + ":" + request.getServerPort();
        }
        return proto + "://" + host;
    }
}
