package com.imhgl.workbench.devsetup.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.imhgl.workbench.common.exception.BusinessException;
import com.imhgl.workbench.common.exception.ErrorCode;
import com.imhgl.workbench.devsetup.entity.SetupArtifactDO;
import com.imhgl.workbench.devsetup.entity.SetupConfigFileDO;
import com.imhgl.workbench.devsetup.entity.SetupToolDO;
import com.imhgl.workbench.devsetup.mapper.SetupArtifactMapper;
import com.imhgl.workbench.devsetup.mapper.SetupConfigFileMapper;
import com.imhgl.workbench.devsetup.mapper.SetupToolMapper;
import com.imhgl.workbench.devsetup.model.SetupArtifact;
import com.imhgl.workbench.devsetup.model.SetupConfigFile;
import com.imhgl.workbench.devsetup.model.SetupConfigFileContent;
import com.imhgl.workbench.devsetup.model.SetupManifest;
import com.imhgl.workbench.devsetup.model.SetupTool;
import com.imhgl.workbench.infrastructure.storage.oss.OssStorage;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Set;

/**
 * 开发环境管家服务：工具清单 / 配置文件 / 二进制工件的 CRUD 与引导清单组装。
 * 工件二进制内容存阿里云 OSS（流式上传，不占内存），MySQL 只存元数据；
 * 引导脚本（bootstrap.ps1）运行时通过 manifest 接口拉取启用项，服务端不做任何安装动作。
 */
@Service
public class DevSetupService {

    /** 合法的工具安装类型 */
    public static final Set<String> CATEGORIES = Set.of("WINGET", "ZIP", "IDEA_PLUGIN");

    /** 工件大小上限，与 spring.servlet.multipart 配置保持一致 */
    private static final long MAX_ARTIFACT_SIZE = 16L * 1024 * 1024;

    private final SetupToolMapper toolMapper;
    private final SetupConfigFileMapper configFileMapper;
    private final SetupArtifactMapper artifactMapper;
    private final OssStorage ossStorage;

    public DevSetupService(SetupToolMapper toolMapper,
                           SetupConfigFileMapper configFileMapper,
                           SetupArtifactMapper artifactMapper,
                           OssStorage ossStorage) {
        this.toolMapper = toolMapper;
        this.configFileMapper = configFileMapper;
        this.artifactMapper = artifactMapper;
        this.ossStorage = ossStorage;
    }

    // ---------- 工具清单 ----------

    public List<SetupTool> listTools() {
        List<SetupToolDO> dos = toolMapper.selectList(
                new LambdaQueryWrapper<SetupToolDO>().orderByAsc(SetupToolDO::getSort).orderByAsc(SetupToolDO::getId));
        return dos.stream().map(DevSetupService::toTool).toList();
    }

    public void createTool(SetupToolDO tool) {
        validateCategory(tool.getCategory());
        tool.setId(null);
        if (tool.getEnabled() == null) {
            tool.setEnabled(true);
        }
        if (tool.getSort() == null) {
            tool.setSort(0);
        }
        toolMapper.insert(tool);
    }

    public void updateTool(Long id, SetupToolDO tool) {
        requireTool(id);
        validateCategory(tool.getCategory());
        tool.setId(id);
        toolMapper.updateById(tool);
    }

    public void deleteTool(Long id) {
        requireTool(id);
        toolMapper.deleteById(id);
    }

    // ---------- 配置文件 ----------

    /** 列表只返回元信息，不含内容 */
    public List<SetupConfigFile> listConfigFiles() {
        List<SetupConfigFileDO> dos = configFileMapper.selectList(
                new LambdaQueryWrapper<SetupConfigFileDO>().orderByAsc(SetupConfigFileDO::getId));
        return dos.stream().map(DevSetupService::toConfigFile).toList();
    }

    public SetupConfigFileDO getConfigFile(Long id) {
        SetupConfigFileDO config = configFileMapper.selectById(id);
        if (config == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "配置文件不存在");
        }
        return config;
    }

    public void createConfigFile(SetupConfigFileDO config) {
        validateConfigFile(config);
        config.setId(null);
        if (config.getEnabled() == null) {
            config.setEnabled(true);
        }
        configFileMapper.insert(config);
    }

    public void updateConfigFile(Long id, SetupConfigFileDO config) {
        getConfigFile(id);
        validateConfigFile(config);
        config.setId(id);
        configFileMapper.updateById(config);
    }

    public void deleteConfigFile(Long id) {
        getConfigFile(id);
        configFileMapper.deleteById(id);
    }

    // ---------- 二进制工件（IDEA 配置快照等） ----------

    public List<SetupArtifact> listArtifacts() {
        List<SetupArtifactDO> dos = artifactMapper.selectList(
                new LambdaQueryWrapper<SetupArtifactDO>().orderByDesc(SetupArtifactDO::getUpdateTime));
        return dos.stream().map(DevSetupService::toArtifact).toList();
    }

    /** 上传即覆盖同名工件（name 为下载路径的一部分）；内容流式写 OSS，元数据落库 */
    public void saveArtifact(String name, String note, MultipartFile file) {
        if (name == null || name.isBlank()) {
            throw new BusinessException("工件名不能为空");
        }
        if (!name.matches("[A-Za-z0-9._-]{1,100}")) {
            throw new BusinessException("工件名只允许字母、数字、点、下划线、连字符");
        }
        if (file == null || file.isEmpty()) {
            throw new BusinessException("上传文件不能为空");
        }
        if (file.getSize() > MAX_ARTIFACT_SIZE) {
            throw new BusinessException("文件超过 16MB 上限");
        }
        String ossKey = ossStorage.key("devsetup/" + name);
        try (InputStream in = file.getInputStream()) {
            ossStorage.put(ossKey, in, file.getSize());
        } catch (IOException e) {
            throw new BusinessException("读取上传文件失败");
        }
        SetupArtifactDO existing = artifactMapper.selectOne(
                new LambdaQueryWrapper<SetupArtifactDO>().eq(SetupArtifactDO::getName, name));
        SetupArtifactDO artifact = existing != null ? existing : new SetupArtifactDO();
        artifact.setName(name);
        artifact.setFilename(file.getOriginalFilename());
        artifact.setOssKey(ossKey);
        artifact.setSize(file.getSize());
        if (note != null && !note.isBlank()) {
            artifact.setNote(note);
        }
        if (existing == null) {
            artifactMapper.insert(artifact);
        } else {
            artifactMapper.updateById(artifact);
        }
    }

    /** 取工件的 OSS 预签名下载 URL（短时效，附件名带上传文件名） */
    public String artifactDownloadUrl(String name) {
        SetupArtifactDO artifact = requireArtifact(name);
        return ossStorage.presignGet(artifact.getOssKey(), artifact.getFilename());
    }

    /** 先删 OSS 对象，再删元数据行 */
    public void deleteArtifact(String name) {
        SetupArtifactDO artifact = requireArtifact(name);
        ossStorage.delete(artifact.getOssKey());
        artifactMapper.deleteById(artifact.getId());
    }

    private SetupArtifactDO requireArtifact(String name) {
        SetupArtifactDO artifact = artifactMapper.selectOne(
                new LambdaQueryWrapper<SetupArtifactDO>().eq(SetupArtifactDO::getName, name));
        if (artifact == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "工件不存在");
        }
        return artifact;
    }

    // ---------- 引导清单 ----------

    /** 只含启用项；配置文件带完整内容；工件按更新时间倒序（引导脚本默认恢复最新） */
    public SetupManifest manifest() {
        SetupManifest manifest = new SetupManifest();

        List<SetupToolDO> toolDos = toolMapper.selectList(new LambdaQueryWrapper<SetupToolDO>()
                .eq(SetupToolDO::getEnabled, true)
                .orderByAsc(SetupToolDO::getSort).orderByAsc(SetupToolDO::getId));
        manifest.setTools(toolDos.stream().map(DevSetupService::toTool).toList());

        List<SetupConfigFileDO> configDos = configFileMapper.selectList(new LambdaQueryWrapper<SetupConfigFileDO>()
                .eq(SetupConfigFileDO::getEnabled, true)
                .orderByAsc(SetupConfigFileDO::getId));
        manifest.setConfigFiles(configDos.stream().map(config -> {
            SetupConfigFileContent c = new SetupConfigFileContent();
            c.setName(config.getName());
            c.setTargetPath(config.getTargetPath());
            c.setContent(config.getContent());
            return c;
        }).toList());

        manifest.setArtifacts(listArtifacts());
        return manifest;
    }

    // ---------- 私有 ----------

    private void validateCategory(String category) {
        if (category == null || !CATEGORIES.contains(category)) {
            throw new BusinessException("安装类型必须是 WINGET / ZIP / IDEA_PLUGIN 之一");
        }
    }

    private void validateConfigFile(SetupConfigFileDO config) {
        if (config.getName() == null || config.getName().isBlank()) {
            throw new BusinessException("配置名称不能为空");
        }
        if (config.getTargetPath() == null || config.getTargetPath().isBlank()) {
            throw new BusinessException("目标路径不能为空");
        }
        if (config.getContent() == null) {
            throw new BusinessException("配置内容不能为空");
        }
    }

    private void requireTool(Long id) {
        if (toolMapper.selectById(id) == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "工具不存在");
        }
    }

    private static SetupTool toTool(SetupToolDO source) {
        SetupTool target = new SetupTool();
        target.setId(source.getId());
        target.setName(source.getName());
        target.setCategory(source.getCategory());
        target.setSourceRef(source.getSourceRef());
        target.setVersion(source.getVersion());
        target.setEnabled(source.getEnabled());
        target.setSort(source.getSort());
        target.setNote(source.getNote());
        return target;
    }

    private static SetupConfigFile toConfigFile(SetupConfigFileDO source) {
        SetupConfigFile target = new SetupConfigFile();
        target.setId(source.getId());
        target.setName(source.getName());
        target.setTargetPath(source.getTargetPath());
        target.setEnabled(source.getEnabled());
        target.setNote(source.getNote());
        return target;
    }

    private static SetupArtifact toArtifact(SetupArtifactDO source) {
        SetupArtifact target = new SetupArtifact();
        target.setId(source.getId());
        target.setName(source.getName());
        target.setFilename(source.getFilename());
        target.setSize(source.getSize());
        target.setNote(source.getNote());
        target.setUpdateTime(source.getUpdateTime());
        return target;
    }
}
