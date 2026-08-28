package com.imhgl.workbench.devsetup.api.impl;

import com.imhgl.workbench.devsetup.api.DevSetupApi;
import com.imhgl.workbench.devsetup.dto.SetupConfigFileRequest;
import com.imhgl.workbench.devsetup.dto.SetupToolRequest;
import com.imhgl.workbench.devsetup.entity.SetupArtifactDO;
import com.imhgl.workbench.devsetup.entity.SetupConfigFileDO;
import com.imhgl.workbench.devsetup.entity.SetupToolDO;
import com.imhgl.workbench.devsetup.model.SetupArtifact;
import com.imhgl.workbench.devsetup.model.SetupConfigFile;
import com.imhgl.workbench.devsetup.model.SetupConfigFileContent;
import com.imhgl.workbench.devsetup.model.SetupManifest;
import com.imhgl.workbench.devsetup.model.SetupTool;
import com.imhgl.workbench.devsetup.service.BootstrapScriptBuilder;
import com.imhgl.workbench.devsetup.service.DevSetupService;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

/**
 * DevSetupApi 实现：dto → DO → service 的装配层，对外只暴露模型与契约。
 */
@Service
public class DevSetupApiImpl implements DevSetupApi {

    private final DevSetupService service;
    private final BootstrapScriptBuilder scriptBuilder;

    public DevSetupApiImpl(DevSetupService service, BootstrapScriptBuilder scriptBuilder) {
        this.service = service;
        this.scriptBuilder = scriptBuilder;
    }

    // ---------- 工具清单 ----------

    @Override
    public List<SetupTool> listTools() {
        return service.listTools();
    }

    @Override
    public void createTool(SetupToolRequest request) {
        service.createTool(toToolDO(request));
    }

    @Override
    public void updateTool(Long id, SetupToolRequest request) {
        service.updateTool(id, toToolDO(request));
    }

    @Override
    public void deleteTool(Long id) {
        service.deleteTool(id);
    }

    // ---------- 配置文件 ----------

    @Override
    public List<SetupConfigFile> listConfigFiles() {
        return service.listConfigFiles();
    }

    @Override
    public SetupConfigFileContent getConfigFile(Long id) {
        SetupConfigFileDO config = service.getConfigFile(id);
        SetupConfigFileContent content = new SetupConfigFileContent();
        content.setId(config.getId());
        content.setName(config.getName());
        content.setTargetPath(config.getTargetPath());
        content.setContent(config.getContent());
        content.setEnabled(config.getEnabled());
        content.setNote(config.getNote());
        return content;
    }

    @Override
    public void createConfigFile(SetupConfigFileRequest request) {
        service.createConfigFile(toConfigFileDO(request));
    }

    @Override
    public void updateConfigFile(Long id, SetupConfigFileRequest request) {
        service.updateConfigFile(id, toConfigFileDO(request));
    }

    @Override
    public void deleteConfigFile(Long id) {
        service.deleteConfigFile(id);
    }

    // ---------- 二进制工件 ----------

    @Override
    public List<SetupArtifact> listArtifacts() {
        return service.listArtifacts();
    }

    @Override
    public void saveArtifact(String name, String note, MultipartFile file) {
        service.saveArtifact(name, note, file);
    }

    @Override
    public String artifactDownloadUrl(String name) {
        return service.artifactDownloadUrl(name);
    }

    @Override
    public void deleteArtifact(String name) {
        service.deleteArtifact(name);
    }

    // ---------- 清单与脚本 ----------

    @Override
    public SetupManifest manifest() {
        return service.manifest();
    }

    @Override
    public String bootstrapScript(String baseUrl) {
        return scriptBuilder.bootstrap(baseUrl);
    }

    @Override
    public String captureScript() {
        return scriptBuilder.capture();
    }

    // ---------- 私有 ----------

    private SetupToolDO toToolDO(SetupToolRequest request) {
        SetupToolDO tool = new SetupToolDO();
        tool.setName(request.getName());
        tool.setCategory(request.getCategory());
        tool.setSourceRef(request.getSourceRef());
        tool.setVersion(request.getVersion());
        tool.setEnabled(request.getEnabled());
        tool.setSort(request.getSort());
        tool.setNote(request.getNote());
        return tool;
    }

    private SetupConfigFileDO toConfigFileDO(SetupConfigFileRequest request) {
        SetupConfigFileDO config = new SetupConfigFileDO();
        config.setName(request.getName());
        config.setTargetPath(request.getTargetPath());
        config.setContent(request.getContent());
        config.setEnabled(request.getEnabled());
        config.setNote(request.getNote());
        return config;
    }
}
