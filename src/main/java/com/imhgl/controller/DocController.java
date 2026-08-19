package com.imhgl.controller;

import com.imhgl.model.ApiResult;
import com.imhgl.model.DocContent;
import com.imhgl.model.DocNode;
import com.imhgl.model.RenameRequest;
import com.imhgl.model.SaveRequest;
import com.imhgl.model.SearchHit;
import com.imhgl.service.DocService;
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

@RestController
@RequestMapping("/api")
public class DocController {

    private final DocService docService;

    public DocController(DocService docService) {
        this.docService = docService;
    }

    @GetMapping("/tree")
    public ApiResult<DocNode> tree() throws Exception {
        return ApiResult.ok(docService.tree());
    }

    @GetMapping("/doc")
    public ApiResult<DocContent> doc(@RequestParam("path") String path) throws Exception {
        return ApiResult.ok(docService.read(path));
    }

    @PostMapping("/doc")
    public ApiResult<Void> create(@RequestBody SaveRequest request) {
        try {
            docService.create(request.getPath(), request.getContent());
            return ApiResult.ok();
        } catch (Exception e) {
            return ApiResult.error(e.getMessage());
        }
    }

    @PutMapping("/doc")
    public ApiResult<Void> save(@RequestBody SaveRequest request) {
        try {
            docService.save(request.getPath(), request.getContent());
            return ApiResult.ok();
        } catch (Exception e) {
            return ApiResult.error(e.getMessage());
        }
    }

    @PostMapping("/dir")
    public ApiResult<Void> createDir(@RequestBody Map<String, String> body) {
        try {
            docService.createDir(body.get("path"));
            return ApiResult.ok();
        } catch (Exception e) {
            return ApiResult.error(e.getMessage());
        }
    }

    @PostMapping("/rename")
    public ApiResult<Void> rename(@RequestBody RenameRequest request) {
        try {
            docService.rename(request.getFrom(), request.getTo());
            return ApiResult.ok();
        } catch (Exception e) {
            return ApiResult.error(e.getMessage());
        }
    }

    @DeleteMapping("/resource")
    public ApiResult<Void> delete(@RequestParam("path") String path) {
        try {
            docService.delete(path);
            return ApiResult.ok();
        } catch (Exception e) {
            return ApiResult.error(e.getMessage());
        }
    }

    @GetMapping("/search")
    public ApiResult<List<SearchHit>> search(@RequestParam("q") String q) throws Exception {
        return ApiResult.ok(docService.search(q));
    }
}
