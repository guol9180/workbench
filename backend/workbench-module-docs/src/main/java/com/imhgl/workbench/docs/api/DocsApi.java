package com.imhgl.workbench.docs.api;

import com.imhgl.workbench.docs.model.DocContent;
import com.imhgl.workbench.docs.model.DocNode;
import com.imhgl.workbench.docs.model.SearchHit;

import java.io.IOException;
import java.util.List;

/**
 * 在线文档模块对外契约：其他模块（及本模块 controller）访问文档能力的唯一入口。
 * 禁止跨模块直接调用本模块的 service、storage 适配或 controller。
 */
public interface DocsApi {

    DocNode tree() throws IOException;

    DocContent read(String relPath) throws IOException;

    void create(String relPath, String content) throws IOException;

    void save(String relPath, String content) throws IOException;

    void createDir(String relPath) throws IOException;

    void rename(String from, String to) throws IOException;

    void delete(String relPath) throws IOException;

    List<SearchHit> search(String query) throws IOException;
}
