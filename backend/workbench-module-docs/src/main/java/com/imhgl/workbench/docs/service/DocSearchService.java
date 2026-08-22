package com.imhgl.workbench.docs.service;

import com.imhgl.workbench.docs.model.SearchHit;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.stream.Stream;

/**
 * 文档搜索：文件名与内容关键字匹配 + 命中行摘要，结果上限 100 条。
 * 文件遍历、扩展名白名单与路径规则全部复用 DocStorage。
 */
@Service
public class DocSearchService {

    private static final int SEARCH_LIMIT = 100;
    private static final int SNIPPET_LENGTH = 120;

    private final DocStorage storage;

    public DocSearchService(DocStorage storage) {
        this.storage = storage;
    }

    public List<SearchHit> search(String query) throws IOException {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        List<SearchHit> hits = new ArrayList<>();
        if (q.isEmpty()) {
            return hits;
        }
        try (Stream<Path> stream = Files.walk(storage.getRoot())) {
            for (Path p : stream.filter(Files::isRegularFile).filter(storage::isDocFile).sorted().toList()) {
                String hit = matchFile(p, q);
                if (hit != null) {
                    hits.add(new SearchHit(storage.toRel(p), hit));
                    if (hits.size() >= SEARCH_LIMIT) {
                        break;
                    }
                }
            }
        }
        return hits;
    }

    private String matchFile(Path file, String lowerQuery) {
        String name = file.getFileName().toString();
        String snippet = null;
        if (name.toLowerCase(Locale.ROOT).contains(lowerQuery)) {
            snippet = "【文件名匹配】" + name;
        }
        try {
            String content = Files.readString(file, StandardCharsets.UTF_8);
            String[] lines = content.split("\n", -1);
            for (String line : lines) {
                if (line.toLowerCase(Locale.ROOT).contains(lowerQuery)) {
                    String trimmed = line.strip();
                    if (trimmed.length() > SNIPPET_LENGTH) {
                        trimmed = trimmed.substring(0, SNIPPET_LENGTH) + "…";
                    }
                    snippet = (snippet == null ? "" : snippet + " / ") + trimmed;
                    break;
                }
            }
        } catch (IOException ignored) {
            // 跳过无法读取的文件
        }
        return snippet;
    }
}
