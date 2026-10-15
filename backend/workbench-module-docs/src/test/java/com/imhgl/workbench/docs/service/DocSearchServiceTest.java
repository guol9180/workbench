package com.imhgl.workbench.docs.service;

import com.imhgl.workbench.docs.model.SearchHit;
import com.imhgl.workbench.infrastructure.storage.FileStorageProperties;
import com.imhgl.workbench.infrastructure.storage.FileTreeStorage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 搜索语义矩阵：双匹配、行号、截断、大小写、上限、懒遍历短路、坏文件跳过。
 */
class DocSearchServiceTest {

    private FileTreeStorage storage(Path root) {
        return new FileTreeStorage(new FileStorageProperties(root.toString(), Set.of("md", "markdown", "txt")));
    }

    @Test
    @DisplayName("仅文件名命中：fileNameMatch=true、line=0、snippet=文件名")
    void filenameOnlyHit(@TempDir Path root) throws IOException {
        FileTreeStorage storage = storage(root);
        storage.create("中文笔记.md", "无关内容");
        List<SearchHit> hits = new DocSearchService(storage).search("中文");
        assertEquals(1, hits.size());
        SearchHit h = hits.get(0);
        assertEquals("中文笔记.md", h.path());
        assertEquals("中文笔记.md", h.name());
        assertTrue(h.fileNameMatch());
        assertEquals(0, h.line());
        assertEquals("中文笔记.md", h.snippet());
    }

    @Test
    @DisplayName("仅内容命中：大小写不敏感、行号 1 起、snippet 取命中行")
    void contentHitWithLine(@TempDir Path root) throws IOException {
        FileTreeStorage storage = storage(root);
        storage.create("plain.md", "first line\nHELLO world\nthird");
        List<SearchHit> hits = new DocSearchService(storage).search("hello");
        assertEquals(1, hits.size());
        SearchHit h = hits.get(0);
        assertEquals("plain.md", h.path());
        assertEquals("plain.md", h.name());
        assertEquals(false, h.fileNameMatch());
        assertEquals(2, h.line());
        assertEquals("HELLO world", h.snippet());
    }

    @Test
    @DisplayName("双命中：fileNameMatch 与内容行号都给，snippet 取内容命中")
    void bothMatches(@TempDir Path root) throws IOException {
        FileTreeStorage storage = storage(root);
        storage.create("hello.md", "hello here");
        List<SearchHit> hits = new DocSearchService(storage).search("hello");
        assertEquals(1, hits.size());
        SearchHit h = hits.get(0);
        assertTrue(h.fileNameMatch());
        assertEquals(1, h.line());
        assertEquals("hello here", h.snippet());
    }

    @Test
    @DisplayName("超长行截断为 120 字符加省略号")
    void snippetTruncated(@TempDir Path root) throws IOException {
        FileTreeStorage storage = storage(root);
        storage.create("long.md", "x".repeat(130));
        List<SearchHit> hits = new DocSearchService(storage).search("xxx");
        assertEquals(1, hits.size());
        assertEquals(121, hits.get(0).snippet().length());
        assertTrue(hits.get(0).snippet().endsWith("…"));
    }

    @Test
    @DisplayName("空查询返回空列表；非白名单与非常规文件不参与")
    void emptyQueryAndSkippedFiles(@TempDir Path root) throws IOException {
        FileTreeStorage storage = storage(root);
        storage.createDir("weird.md");
        Files.writeString(root.resolve("ignored.exe"), "hit");
        assertTrue(new DocSearchService(storage).search("").isEmpty());
        assertTrue(new DocSearchService(storage).search("hit").isEmpty());
    }

    @Test
    @DisplayName("上限 100：按相对路径字典序，命中满即停（懒遍历，后续文件不被读取）")
    void limitWithLazyShortCircuit(@TempDir Path root) throws IOException {
        CountingStorage storage = new CountingStorage(root);
        for (int i = 0; i < 105; i++) {
            storage.create("f%03d.md".formatted(i), "hit");
        }
        List<SearchHit> hits = new DocSearchService(storage).search("hit");
        assertEquals(100, hits.size());
        assertEquals(100, storage.reads, "命中满 100 后不得再读文件内容");
        assertEquals("f000.md", hits.get(0).path());
        assertEquals("f099.md", hits.get(99).path());
    }

    /** 统计内容读取次数的探针存储：验证懒遍历短路 */
    static class CountingStorage extends FileTreeStorage {
        int reads = 0;

        CountingStorage(Path root) {
            super(new FileStorageProperties(root.toString(), Set.of("md", "markdown", "txt")));
        }

        @Override
        public String read(String relPath) throws IOException {
            reads++;
            return super.read(relPath);
        }
    }
}
