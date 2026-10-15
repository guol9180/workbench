package com.imhgl.workbench.docs.service;

import com.imhgl.workbench.docs.model.DocPath;
import com.imhgl.workbench.docs.model.SearchHit;
import com.imhgl.workbench.infrastructure.storage.FileTreeStorage;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;

/**
 * 文档搜索：文件名与内容双匹配、大小写不敏感、命中上限 100、相对路径字典序。
 * <p>算法要点：路径清单一次性物化（仅元数据，开销小），内容读取按序懒加载并在命中满时短路，
 * 不做整树内容物化。内容读取统一走受控入口 {@link FileTreeStorage#read(String)}。
 */
@Service
public class DocSearchService {

    static final int SEARCH_LIMIT = 100;
    static final int SNIPPET_LENGTH = 120;

    private final FileTreeStorage storage;

    public DocSearchService(FileTreeStorage storage) {
        this.storage = storage;
    }

    public List<SearchHit> search(String query) throws IOException {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        if (q.isEmpty()) {
            return List.of();
        }
        List<String> relPaths;
        try (Stream<Path> stream = Files.walk(storage.getRoot())) {
            relPaths = stream
                    .filter(Files::isRegularFile)
                    .filter(storage::isAllowedFile)
                    .map(storage::toRel)
                    .sorted()
                    .toList();
        }
        List<SearchHit> hits = new ArrayList<>();
        for (String rel : relPaths) {
            SearchHit hit = matchFile(rel, q);
            if (hit != null) {
                hits.add(hit);
                if (hits.size() >= SEARCH_LIMIT) {
                    break;
                }
            }
        }
        return hits;
    }

    /** 单文件匹配；任何读取失败（并发删除、权限等）静默跳过 */
    private SearchHit matchFile(String rel, String q) {
        DocPath path = DocPath.of(rel);
        boolean nameHit = path.name().toLowerCase(Locale.ROOT).contains(q);
        Integer line = null;
        String snippet = null;
        try {
            String content = storage.read(rel);
            String[] lines = content.split("\n", -1);
            for (int i = 0; i < lines.length; i++) {
                if (lines[i].toLowerCase(Locale.ROOT).contains(q)) {
                    line = i + 1;
                    String s = lines[i].strip();
                    snippet = s.length() > SNIPPET_LENGTH ? s.substring(0, SNIPPET_LENGTH) + "…" : s;
                    break;
                }
            }
        } catch (IOException | RuntimeException e) {
            return null;
        }
        if (line == null && !nameHit) {
            return null;
        }
        return new SearchHit(rel, path.name(), nameHit, line == null ? 0 : line,
                line == null ? path.name() : snippet);
    }
}
