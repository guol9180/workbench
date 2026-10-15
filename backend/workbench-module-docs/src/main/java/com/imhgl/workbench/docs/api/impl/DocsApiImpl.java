package com.imhgl.workbench.docs.api.impl;

import com.imhgl.workbench.docs.api.DocsApi;
import com.imhgl.workbench.docs.model.DocContent;
import com.imhgl.workbench.docs.model.DocNode;
import com.imhgl.workbench.docs.model.DocPath;
import com.imhgl.workbench.docs.model.SearchHit;
import com.imhgl.workbench.docs.service.DocSearchService;
import com.imhgl.workbench.infrastructure.storage.FileTreeStorage;
import com.imhgl.workbench.infrastructure.storage.StorageNode;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

/**
 * DocsApi 实现：把 infrastructure 的中性模型（StorageNode）适配为文档业务语义；
 * 相对路径先经 DocPath 值对象归一化，再交由受控入口 FileTreeStorage 执行。
 */
@Service
public class DocsApiImpl implements DocsApi {

    private final FileTreeStorage storage;
    private final DocSearchService searchService;

    public DocsApiImpl(FileTreeStorage storage, DocSearchService searchService) {
        this.storage = storage;
        this.searchService = searchService;
    }

    @Override
    public DocNode tree() throws IOException {
        return toNode(storage.tree());
    }

    @Override
    public DocContent read(String path) throws IOException {
        DocPath p = DocPath.of(path);
        return new DocContent(p.value(), p.name(), storage.read(p.value()));
    }

    @Override
    public void create(String path, String content) throws IOException {
        storage.create(DocPath.of(path).value(), content);
    }

    @Override
    public void save(String path, String content) throws IOException {
        storage.save(DocPath.of(path).value(), content);
    }

    @Override
    public void createDir(String path) throws IOException {
        storage.createDir(DocPath.of(path).value());
    }

    @Override
    public void rename(String from, String to) throws IOException {
        storage.rename(DocPath.of(from).value(), DocPath.of(to).value());
    }

    @Override
    public void delete(String path) throws IOException {
        storage.delete(DocPath.of(path).value());
    }

    @Override
    public List<SearchHit> search(String query) throws IOException {
        return searchService.search(query);
    }

    private DocNode toNode(StorageNode node) {
        return new DocNode(node.name(), node.path(), node.type(),
                node.children().stream().map(this::toNode).collect(Collectors.toList()));
    }
}
