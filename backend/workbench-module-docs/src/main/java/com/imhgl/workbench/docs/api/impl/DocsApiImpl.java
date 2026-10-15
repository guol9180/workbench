package com.imhgl.workbench.docs.api.impl;

import com.imhgl.workbench.common.exception.BusinessException;
import com.imhgl.workbench.common.exception.ErrorCode;
import com.imhgl.workbench.docs.api.DocsApi;
import com.imhgl.workbench.docs.model.DocContent;
import com.imhgl.workbench.docs.model.DocNode;
import com.imhgl.workbench.docs.model.DocPath;
import com.imhgl.workbench.docs.model.SearchHit;
import com.imhgl.workbench.docs.service.DocSearchService;
import com.imhgl.workbench.infrastructure.storage.FileTreeStorage;
import com.imhgl.workbench.infrastructure.storage.StorageException;
import com.imhgl.workbench.infrastructure.storage.StorageNode;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

/**
 * DocsApi 实现：适配层——两件事。
 * 一、把 infrastructure 的中性模型（StorageNode）适配为文档业务语义（DocNode）；
 * 二、把中性的 StorageException（NOT_FOUND / CONFLICT）翻译为业务错误码
 * （{@link BusinessException}）——中性异常不出技术设施，业务错误码不出现在 infrastructure
 * （翻译约定见 AGENTS.md 第 8 节）。
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
        String content = call(() -> storage.read(p.value()));
        return new DocContent(p.value(), p.name(), content);
    }

    @Override
    public void create(String path, String content) throws IOException {
        DocPath p = DocPath.of(path);
        call(() -> {
            storage.create(p.value(), content);
            return null;
        });
    }

    @Override
    public void save(String path, String content) throws IOException {
        DocPath p = DocPath.of(path);
        call(() -> {
            storage.save(p.value(), content);
            return null;
        });
    }

    @Override
    public void createDir(String path) throws IOException {
        String p = DocPath.of(path).value();
        call(() -> {
            storage.createDir(p);
            return null;
        });
    }

    @Override
    public void rename(String from, String to) throws IOException {
        String f = DocPath.of(from).value();
        String t = DocPath.of(to).value();
        call(() -> {
            storage.rename(f, t);
            return null;
        });
    }

    @Override
    public void delete(String path) throws IOException {
        String p = DocPath.of(path).value();
        call(() -> {
            storage.delete(p);
            return null;
        });
    }

    @Override
    public List<SearchHit> search(String query) throws IOException {
        return searchService.search(query);
    }

    /** 中性模型 → 业务语义：StorageNode 与 DocNode 同形，逐节点转换 */
    private DocNode toNode(StorageNode node) {
        return new DocNode(node.name(), node.path(), node.type(),
                node.children().stream().map(this::toNode).collect(Collectors.toList()));
    }

    /**
     * 受控调用模板：全部 storage 调用的唯一出口，把 StorageException 翻译为业务异常。
     * 抽成模板是因为「翻译」逻辑只允许存在一份（复用优先），而 storage 的方法签名各异。
     */
    private <T> T call(StorageCall<T> action) throws IOException {
        try {
            return action.run();
        } catch (StorageException e) {
            ErrorCode code = switch (e.getReason()) {
                case NOT_FOUND -> ErrorCode.NOT_FOUND;
                case CONFLICT -> ErrorCode.CONFLICT;
            };
            throw new BusinessException(code, e.getMessage());
        }
    }

    /** 与 {@link #call(StorageCall)} 配套的操作签名：storage 方法普遍抛受检 IOException */
    @FunctionalInterface
    interface StorageCall<T> {
        T run() throws IOException;
    }
}
