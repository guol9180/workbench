package com.imhgl.workbench.docs.api;

import com.imhgl.workbench.common.exception.BusinessException;
import com.imhgl.workbench.common.exception.ErrorCode;
import com.imhgl.workbench.docs.model.DocContent;
import com.imhgl.workbench.docs.model.DocNode;
import com.imhgl.workbench.infrastructure.storage.FileStorageProperties;
import com.imhgl.workbench.infrastructure.storage.FileTreeStorage;
import com.imhgl.workbench.docs.service.DocSearchService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * DocsApi 契约实现测试：树、读写、删除、路径安全（经受控入口）。
 */
class DocsApiImplTest {

    private DocsApi api(Path root) {
        FileStorageProperties props = new FileStorageProperties(root.toString(), Set.of("md", "markdown", "txt"));
        FileTreeStorage storage = new FileTreeStorage(props);
        return new com.imhgl.workbench.docs.api.impl.DocsApiImpl(storage, new DocSearchService(storage));
    }

    @Test
    @DisplayName("空树：根节点 name 为空串、type=dir、children 空数组")
    void emptyTree(@TempDir Path root) throws IOException {
        DocNode node = api(root).tree();
        assertEquals("", node.name());
        assertEquals("dir", node.type());
        assertTrue(node.children().isEmpty());
    }

    @Test
    @DisplayName("create→read 全链路：path 归一化、name 取文件名、内容一致")
    void createThenRead(@TempDir Path root) throws IOException {
        DocsApi docs = api(root);
        docs.create("笔记/中文.md", "# hi");
        DocContent c = docs.read("笔记/中文.md");
        assertEquals("笔记/中文.md", c.path());
        assertEquals("中文.md", c.name());
        assertEquals("# hi", c.content());
    }

    @Test
    @DisplayName("save 后再读生效；delete 后读抛业务异常（NOT_FOUND）")
    void saveAndDeleteLifecycle(@TempDir Path root) throws IOException {
        DocsApi docs = api(root);
        docs.create("a.md", "v1");
        docs.save("a.md", "v2");
        assertEquals("v2", docs.read("a.md").content());
        docs.delete("a.md");
        BusinessException e = assertThrows(BusinessException.class, () -> docs.read("a.md"));
        assertEquals(ErrorCode.NOT_FOUND, e.getErrorCode());
    }

    @Test
    @DisplayName("路径安全：穿越与白名单外写入被拒")
    void pathSafetyAndWhitelist(@TempDir Path root) throws IOException {
        DocsApi docs = api(root);
        assertThrows(IllegalArgumentException.class, () -> docs.read("../secret.md"));
        assertThrows(IllegalArgumentException.class, () -> docs.create("evil.exe", "x"));
        assertThrows(IllegalArgumentException.class, () -> docs.rename("a.md", "../b.md"));
    }
}
