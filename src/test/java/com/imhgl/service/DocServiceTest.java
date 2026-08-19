package com.imhgl.service;

import com.imhgl.config.DocsProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DocServiceTest {

    @TempDir
    Path tempDir;

    private DocService service;

    @BeforeEach
    void setUp() throws IOException {
        DocsProperties properties = new DocsProperties();
        properties.setDocsRoot(tempDir.resolve("docs").toString());
        properties.setPassword("test");
        service = new DocService(properties);
        service.init();
    }

    @Test
    @DisplayName("../ 路径穿越被拒绝")
    void resolveRejectsPathTraversal() {
        assertThrows(IllegalArgumentException.class, () -> service.resolve("../secret.md"));
        assertThrows(IllegalArgumentException.class, () -> service.resolve("日志/../../secret.md"));
        assertThrows(IllegalArgumentException.class, () -> service.resolve("a/../../../etc/passwd"));
    }

    @Test
    @DisplayName("正常相对路径可以解析")
    void resolveAcceptsNormalPath() {
        assertDoesNotThrow(() -> service.resolve("日志/2026-08/2026-08-19.md"));
        assertDoesNotThrow(() -> service.resolve(""));
    }

    @Test
    @DisplayName("通过 resolve 的路径即使已符号语义混淆也在根目录内")
    void resolveNormalizesInsideRoot() {
        Path resolved = service.resolve("日志/./2026/../2026/x.md");
        assertTrue(resolved.startsWith(service.getRoot()));
    }

    @Test
    @DisplayName("创建/读取/保存文档")
    void createReadSaveDoc() throws IOException {
        service.create("笔记/测试.md", "# hello");
        assertEquals("# hello", service.read("笔记/测试.md").getContent());
        service.save("笔记/测试.md", "# changed");
        assertEquals("# changed", service.read("笔记/测试.md").getContent());
    }

    @Test
    @DisplayName("创建非白名单扩展名被拒绝")
    void createRejectsNonDocExtension() {
        assertThrows(IllegalArgumentException.class, () -> service.create("evil.sh", "#!/bin/sh"));
        assertThrows(IllegalArgumentException.class, () -> service.create("noext", "x"));
    }

    @Test
    @DisplayName("重复创建同名文件报错")
    void createDuplicateFails() throws IOException {
        service.create("a.md", "1");
        assertThrows(IllegalArgumentException.class, () -> service.create("a.md", "2"));
    }

    @Test
    @DisplayName("重命名到越界路径被拒绝")
    void renameRejectsEscape() throws IOException {
        service.create("a.md", "1");
        assertThrows(IllegalArgumentException.class, () -> service.rename("a.md", "../outside.md"));
    }

    @Test
    @DisplayName("搜索文件名与内容")
    void searchFindsNameAndContent() throws IOException {
        service.create("日志/demo.md", "# 今天完成了发版\n- 修复登录问题");
        service.create("其他/note.md", "无关内容");
        List<?> hits = service.search("发版");
        assertEquals(1, hits.size());
        List<?> byName = service.search("demo");
        assertEquals(1, byName.size());
    }

    @Test
    @DisplayName("文件树包含新建的目录与文件")
    void treeContainsCreatedEntries() throws IOException {
        service.createDir("项目A");
        service.create("项目A/readme.md", "x");
        assertNotNull(service.tree().getChildren());
        assertEquals(1, service.tree().getChildren().size());
        assertEquals("项目A", service.tree().getChildren().get(0).getName());
    }
}
