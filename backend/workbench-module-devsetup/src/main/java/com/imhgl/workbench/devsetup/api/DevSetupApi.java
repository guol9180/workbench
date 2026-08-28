package com.imhgl.workbench.devsetup.api;

import com.imhgl.workbench.devsetup.dto.SetupConfigFileRequest;
import com.imhgl.workbench.devsetup.dto.SetupToolRequest;
import com.imhgl.workbench.devsetup.model.SetupArtifact;
import com.imhgl.workbench.devsetup.model.SetupConfigFile;
import com.imhgl.workbench.devsetup.model.SetupConfigFileContent;
import com.imhgl.workbench.devsetup.model.SetupManifest;
import com.imhgl.workbench.devsetup.model.SetupTool;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * 开发环境管家模块对外唯一契约：工具清单 / 配置文件 / 二进制工件与引导脚本。
 * 跨模块调用只允许注入本接口。
 */
public interface DevSetupApi {

    // ---------- 工具清单 ----------

    List<SetupTool> listTools();

    void createTool(SetupToolRequest request);

    void updateTool(Long id, SetupToolRequest request);

    void deleteTool(Long id);

    // ---------- 配置文件 ----------

    /** 列表只含元信息，不含内容 */
    List<SetupConfigFile> listConfigFiles();

    /** 详情含内容 */
    SetupConfigFileContent getConfigFile(Long id);

    void createConfigFile(SetupConfigFileRequest request);

    void updateConfigFile(Long id, SetupConfigFileRequest request);

    void deleteConfigFile(Long id);

    // ---------- 二进制工件（IDEA 配置快照等） ----------

    List<SetupArtifact> listArtifacts();

    /** 上传即覆盖同名工件（内容存 OSS，元数据落库） */
    void saveArtifact(String name, String note, MultipartFile file);

    /** 工件的 OSS 预签名下载 URL（短时效，controller 以 302 跳转，流量不经后端） */
    String artifactDownloadUrl(String name);

    void deleteArtifact(String name);

    // ---------- 清单与脚本 ----------

    SetupManifest manifest();

    /** 新机引导脚本（PowerShell 源码，不含 BOM/CRLF，由 controller 处理编码） */
    String bootstrapScript(String baseUrl);

    /** 旧机 IDEA 配置采集脚本（同上） */
    String captureScript();
}
