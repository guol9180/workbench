package com.imhgl.workbench.infrastructure.storage;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * FileTreeStorage 受控入口测试：路径安全、白名单、CRUD、树构建。
 */
class FileTreeStorageTest {

    private static FileStorageProperties props(Path root) {
        return new FileStorageProperties(root.toString(), Set.of("md", "markdown", "txt"));
    }

    @Test
    @DisplayName("resolve：穿越/绝对路径/空字节一律拒绝")
    void resolveRejectsTraversal(@TempDir Path root) {
        FileTreeStorage storage = new FileTreeStorage(props(root));
        List<String> bad = List.of("../x", "..\\x", "a/../../x", "/abs", "\\abs", "C:/x", "a\0b");
        for (String p : bad) {
            assertThrows(IllegalArgumentException.class, () -> storage.resolve(p), "应拒绝：" + p);
        }
    }

    @Test
    @DisplayName("resolve：null/空/点归约为根，正常相对路径落在根内")
    void resolveNormalizesInsideRoot(@TempDir Path root) {
        FileTreeStorage storage = new FileTreeStorage(props(root));
        assertEquals(root, storage.resolve(null));
        assertEquals(root, storage.resolve(""));
        assertEquals(root, storage.resolve("."));
        Path p = storage.resolve("a/b.md");
        assertTrue(p.startsWith(root));
        assertFalse(storage.getRoot().relativize(p).toString().contains(".."));
    }

    @Test
    @DisplayName("validateName：空/分隔符/点段拒绝")
    void validateNameRejectsBadNames(@TempDir Path root) {
        FileTreeStorage storage = new FileTreeStorage(props(root));
        for (String bad : List.of("", "  ", "a/b", "a\\b", ".", "..")) {
            assertThrows(IllegalArgumentException.class, () -> storage.validateName(bad), "应拒绝：" + bad);
        }
        storage.validateName("ok-name.md");
    }

    @Test
    @DisplayName("validateExtension：白名单小写比对，A.MD 放行、a.exe 拒绝")
    void validateExtensionUsesLowercaseWhitelist(@TempDir Path root) {
        FileTreeStorage storage = new FileTreeStorage(props(root));
        storage.validateExtension(root.resolve("a.md"));
        storage.validateExtension(root.resolve("A.MD"));
        assertThrows(IllegalArgumentException.class, () -> storage.validateExtension(root.resolve("a.exe")));
    }

    @Test
    @DisplayName("create/read/save：往返一致、重复建拒、保存不存在拒、null 内容按空串")
    void createReadSaveRoundTrip(@TempDir Path root) throws IOException {
        FileTreeStorage storage = new FileTreeStorage(props(root));
        storage.create("笔记/中文.md", "# hi");
        assertEquals("# hi", storage.read("笔记/中文.md"));

        assertThrows(IllegalArgumentException.class, () -> storage.create("笔记/中文.md", "dup"));
        assertThrows(IllegalArgumentException.class, () -> storage.save("不存在.md", "x"));
        assertThrows(IllegalArgumentException.class, () -> storage.create("evil.exe", "x"));

        storage.create("empty.md", null);
        assertEquals("", storage.read("empty.md"));

        storage.save("笔记/中文.md", "# updated");
        assertEquals("# updated", storage.read("笔记/中文.md"));
    }

    @Test
    @DisplayName("createDir/rename/delete：目录与文件全生命周期")
    void dirRenameDeleteLifecycle(@TempDir Path root) throws IOException {
        FileTreeStorage storage = new FileTreeStorage(props(root));

        storage.createDir("d1");
        assertThrows(IllegalArgumentException.class, () -> storage.createDir("d1"));

        storage.create("d1/f.md", "content");
        storage.rename("d1", "d2");
        assertEquals("content", storage.read("d2/f.md"));
        assertThrows(IllegalArgumentException.class, () -> storage.read("d1/f.md"));

        storage.create("a.md", "a");
        storage.create("b.md", "b");
        assertThrows(IllegalArgumentException.class, () -> storage.rename("a.md", "b.md"));

        // 重命名/删除根目录拒绝；目标落在源子树内拒绝
        assertThrows(IllegalArgumentException.class, () -> storage.rename("", "x"));
        assertThrows(IllegalArgumentException.class, () -> storage.delete(""));
        assertThrows(IllegalArgumentException.class, () -> storage.rename("d2", "d2/sub"));

        storage.rename("a.md", " renamed.md ");
        assertEquals("a", storage.read("renamed.md"));

        storage.delete("d2");
        assertFalse(Files.exists(root.resolve("d2")));
        assertThrows(IllegalArgumentException.class, () -> storage.delete("不存在.md"));
    }

    @Test
    @DisplayName("tree：目录优先 + 不分大小写排序，白名单外过滤")
    void treeSortsDirsFirstAndFilters(@TempDir Path root) throws IOException {
        FileTreeStorage storage = new FileTreeStorage(props(root));
        storage.createDir("sub");
        storage.create("sub/c.md", "c");
        storage.create("b.md", "b");
        storage.create("A.md", "a");
        Files.writeString(root.resolve("ignored.exe"), "x");
        Files.writeString(root.resolve(".gitkeep"), "");

        StorageNode node = storage.tree();
        assertEquals("", node.name());
        assertEquals("dir", node.type());
        List<String> names = node.children().stream().map(StorageNode::name).toList();
        assertEquals(List.of("sub", "A.md", "b.md"), names);
        assertEquals(List.of("c.md"), node.children().get(0).children().stream().map(StorageNode::name).toList());
    }

    @Test
    @DisplayName("toRel：输出根内正斜杠相对路径")
    void toRelUsesForwardSlashes(@TempDir Path root) throws IOException {
        FileTreeStorage storage = new FileTreeStorage(props(root));
        storage.create("sub/inner.md", "x");
        String rel = storage.toRel(storage.resolve("sub/inner.md"));
        assertEquals("sub/inner.md", rel);
    }
}
