package com.imhgl.workbench.docs.controller;

import com.imhgl.workbench.common.result.ApiResult;
import com.imhgl.workbench.docs.api.DocsApi;
import com.imhgl.workbench.docs.dto.CreateDirRequest;
import com.imhgl.workbench.docs.dto.RenameRequest;
import com.imhgl.workbench.docs.dto.SaveRequest;
import com.imhgl.workbench.docs.model.DocContent;
import com.imhgl.workbench.docs.model.DocNode;
import com.imhgl.workbench.docs.model.SearchHit;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.List;

/**
 * 在线文档模块接口（/api/docs/**）：只依赖本模块 api 层（DocsApi），
 * 薄到「接参 → 调 api → 包 ApiResult」；业务异常由 framework 全局异常处理器统一映射。
 */
@RestController
@RequestMapping("/api/docs")
public class DocController {

    private final DocsApi docsApi;

    public DocController(DocsApi docsApi) {
        this.docsApi = docsApi;
    }

    @GetMapping("/tree")
    public ApiResult<DocNode> tree() throws IOException {
        return ApiResult.ok(docsApi.tree());
    }

    @GetMapping("/file")
    public ApiResult<DocContent> read(@RequestParam("path") String path) throws IOException {
        return ApiResult.ok(docsApi.read(path));
    }

    @PostMapping("/file")
    public ApiResult<Void> create(@Valid @RequestBody SaveRequest request) throws IOException {
        docsApi.create(request.path(), request.content());
        return ApiResult.ok();
    }

    @PutMapping("/file")
    public ApiResult<Void> save(@Valid @RequestBody SaveRequest request) throws IOException {
        docsApi.save(request.path(), request.content());
        return ApiResult.ok();
    }

    @PostMapping("/dir")
    public ApiResult<Void> createDir(@Valid @RequestBody CreateDirRequest request) throws IOException {
        docsApi.createDir(request.path());
        return ApiResult.ok();
    }

    @PostMapping("/rename")
    public ApiResult<Void> rename(@Valid @RequestBody RenameRequest request) throws IOException {
        docsApi.rename(request.from(), request.to());
        return ApiResult.ok();
    }

    @DeleteMapping("/resource")
    public ApiResult<Void> delete(@RequestParam("path") String path) throws IOException {
        docsApi.delete(path);
        return ApiResult.ok();
    }

    @GetMapping("/search")
    public ApiResult<List<SearchHit>> search(@RequestParam("q") String q) throws IOException {
        return ApiResult.ok(docsApi.search(q));
    }
}
