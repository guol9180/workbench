package com.imhgl.workbench.docs.controller;

import com.imhgl.workbench.common.web.ApiResult;
import com.imhgl.workbench.docs.model.DocContent;
import com.imhgl.workbench.docs.model.DocNode;
import com.imhgl.workbench.docs.model.RenameRequest;
import com.imhgl.workbench.docs.model.SaveRequest;
import com.imhgl.workbench.docs.model.SearchHit;
import com.imhgl.workbench.docs.service.DocService;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 在线文档模块接口（/api/docs/**）。
 * 业务异常由 workbench-common 的全局异常处理器统一转换为 400 响应。
 */
@RestController
@RequestMapping("/api/docs")
public class DocController {

    private final DocService docService;

    public DocController(DocService docService) {
        this.docService = docService;
    }

    @GetMapping("/tree")
    public ApiResult<DocNode> tree() throws Exception {
        return ApiResult.ok(docService.tree());
    }

    @GetMapping("/file")
    public ApiResult<DocContent> file(@RequestParam("path") String path) throws Exception {
        return ApiResult.ok(docService.read(path));
    }

    @PostMapping("/file")
    public ApiResult<Void> create(@RequestBody SaveRequest request) throws Exception {
        docService.create(request.getPath(), request.getContent());
        return ApiResult.ok();
    }

    @PutMapping("/file")
    public ApiResult<Void> save(@RequestBody SaveRequest request) throws Exception {
        docService.save(request.getPath(), request.getContent());
        return ApiResult.ok();
    }

    @PostMapping("/dir")
    public ApiResult<Void> createDir(@RequestBody Map<String, String> body) throws Exception {
        docService.createDir(body.get("path"));
        return ApiResult.ok();
    }

    @PostMapping("/rename")
    public ApiResult<Void> rename(@RequestBody RenameRequest request) throws Exception {
        docService.rename(request.getFrom(), request.getTo());
        return ApiResult.ok();
    }

    @DeleteMapping("/resource")
    public ApiResult<Void> delete(@RequestParam("path") String path) throws Exception {
        docService.delete(path);
        return ApiResult.ok();
    }

    @GetMapping("/search")
    public ApiResult<List<SearchHit>> search(@RequestParam("q") String q) throws Exception {
        return ApiResult.ok(docService.search(q));
    }
}
