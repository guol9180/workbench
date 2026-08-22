package com.imhgl.workbench.docs.controller;

import com.imhgl.workbench.docs.api.DocsApi;
import com.imhgl.workbench.docs.dto.CreateDirRequest;
import com.imhgl.workbench.docs.dto.RenameRequest;
import com.imhgl.workbench.docs.dto.SaveRequest;
import com.imhgl.workbench.docs.model.DocContent;
import com.imhgl.workbench.docs.model.DocNode;
import com.imhgl.workbench.docs.model.SearchHit;
import com.imhgl.workbench.common.result.ApiResult;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 在线文档模块接口（/api/docs/**）。
 * 只依赖本模块 api 层（DocsApi）；业务异常由 framework 的全局异常处理器统一转 400。
 */
@RestController
@RequestMapping("/api/docs")
public class DocController {

    private final DocsApi docsApi;

    public DocController(DocsApi docsApi) {
        this.docsApi = docsApi;
    }

    @GetMapping("/tree")
    public ApiResult<DocNode> tree() throws Exception {
        return ApiResult.ok(docsApi.tree());
    }

    @GetMapping("/file")
    public ApiResult<DocContent> file(@RequestParam("path") String path) throws Exception {
        return ApiResult.ok(docsApi.read(path));
    }

    @PostMapping("/file")
    public ApiResult<Void> create(@RequestBody SaveRequest request) throws Exception {
        docsApi.create(request.getPath(), request.getContent());
        return ApiResult.ok();
    }

    @PutMapping("/file")
    public ApiResult<Void> save(@RequestBody SaveRequest request) throws Exception {
        docsApi.save(request.getPath(), request.getContent());
        return ApiResult.ok();
    }

    @PostMapping("/dir")
    public ApiResult<Void> createDir(@RequestBody CreateDirRequest request) throws Exception {
        docsApi.createDir(request.getPath());
        return ApiResult.ok();
    }

    @PostMapping("/rename")
    public ApiResult<Void> rename(@RequestBody RenameRequest request) throws Exception {
        docsApi.rename(request.getFrom(), request.getTo());
        return ApiResult.ok();
    }

    @DeleteMapping("/resource")
    public ApiResult<Void> delete(@RequestParam("path") String path) throws Exception {
        docsApi.delete(path);
        return ApiResult.ok();
    }

    @GetMapping("/search")
    public ApiResult<List<SearchHit>> search(@RequestParam("q") String q) throws Exception {
        return ApiResult.ok(docsApi.search(q));
    }
}
