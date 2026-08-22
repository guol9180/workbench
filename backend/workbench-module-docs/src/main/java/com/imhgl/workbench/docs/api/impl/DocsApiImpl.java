package com.imhgl.workbench.docs.api.impl;

import com.imhgl.workbench.docs.api.DocsApi;
import com.imhgl.workbench.docs.model.DocContent;
import com.imhgl.workbench.docs.model.DocNode;
import com.imhgl.workbench.docs.model.SearchHit;
import com.imhgl.workbench.docs.service.DocSearchService;
import com.imhgl.workbench.infrastructure.storage.FileTreeStorage;
import com.imhgl.workbench.infrastructure.storage.StorageNode;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

/**
 * DocsApi 实现：组合技术设施层的文件存储与模块内搜索服务，
 * 并把中性的存储模型适配为文档领域模型（如根节点命名为「文档库」）。
 */
@Service
public class DocsApiImpl implements DocsApi {

    private final FileTreeStorage storage;
    private final DocSearchService docSearchService;

    public DocsApiImpl(FileTreeStorage storage, DocSearchService docSearchService) {
        this.storage = storage;
        this.docSearchService = docSearchService;
    }

    @Override
    public DocNode tree() throws IOException {
        return convert(storage.tree());
    }

    @Override
    public DocContent read(String relPath) throws IOException {
        String content = storage.read(relPath);
        Path path = storage.resolve(relPath);
        return new DocContent(storage.toRel(path), path.getFileName().toString(), content);
    }

    @Override
    public void create(String relPath, String content) throws IOException {
        storage.create(relPath, content);
    }

    @Override
    public void save(String relPath, String content) throws IOException {
        storage.save(relPath, content);
    }

    @Override
    public void createDir(String relPath) throws IOException {
        storage.createDir(relPath);
    }

    @Override
    public void rename(String from, String to) throws IOException {
        storage.rename(from, to);
    }

    @Override
    public void delete(String relPath) throws IOException {
        storage.delete(relPath);
    }

    @Override
    public List<SearchHit> search(String query) throws IOException {
        return docSearchService.search(query);
    }

    /** 存储节点 → 文档域节点：根节点（path 为空）命名为「文档库」 */
    private DocNode convert(StorageNode source) {
        DocNode target = new DocNode();
        target.setName(source.getPath().isEmpty() ? "文档库" : source.getName());
        target.setPath(source.getPath());
        target.setType(source.getType());
        for (StorageNode child : source.getChildren()) {
            target.getChildren().add(convert(child));
        }
        return target;
    }
}
