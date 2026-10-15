package com.imhgl.workbench.docs.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * DocPath 值对象：归一化与安全校验是唯一入口，非法路径造不出实例。
 */
class DocPathTest {

    @Test
    @DisplayName("null/空白/纯斜杠归约为根")
    void emptyFormsBecomeRoot() {
        for (String raw : new String[]{null, "", "   ", "/", "\\", "//"}) {
            assertTrue(DocPath.of(raw).isRoot(), "应为根：" + raw);
            assertEquals("", DocPath.of(raw).value());
        }
    }

    @Test
    @DisplayName("归一化：反斜杠转正斜杠、去首尾斜杠")
    void normalizesSeparatorsAndEdges() {
        assertEquals("a/b.md", DocPath.of("a\\b.md").value());
        assertEquals("a", DocPath.of("/a/").value());
    }

    @Test
    @DisplayName("非法路径拒绝：穿越、盘符、空段、点段、空字节、内嵌冒号")
    void rejectsIllegalPaths() {
        for (String bad : new String[]{"../x", "a/../../x", "C:/x", "c:\\x", "a//b", "a/./b", "a/..", "a\0b", "a/b:c.md"}) {
            assertThrows(IllegalArgumentException.class, () -> DocPath.of(bad), "应拒绝：" + bad);
        }
    }

    @Test
    @DisplayName("name：末段；根为空串")
    void nameIsLastSegment() {
        assertEquals("b.md", DocPath.of("a/b.md").name());
        assertEquals("", DocPath.ROOT.name());
    }

    @Test
    @DisplayName("extension：小写、无点为空串、多点取最后")
    void extensionIsLowercaseAfterLastDot() {
        assertEquals("md", DocPath.of("B.MD").extension());
        assertEquals("", DocPath.of("noext").extension());
        assertEquals("md", DocPath.of("a.b.md").extension());
    }

    @Test
    @DisplayName("resolve：根拼子路径、逐级拼接、空子路径原样")
    void resolveCombines() {
        assertEquals(DocPath.of("a"), DocPath.ROOT.resolve("a"));
        assertEquals(DocPath.of("a/b.md"), DocPath.of("a").resolve("b.md"));
        assertEquals(DocPath.of("a"), DocPath.of("a").resolve(""));
        assertEquals(DocPath.of("a/b/c.md"), DocPath.of("a").resolve("b/c.md"));
    }

    @Test
    @DisplayName("值语义：归一化后相等（空段被拒绝而非折叠，见非法路径用例）")
    void valueEquality() {
        assertEquals(DocPath.of("a/b"), DocPath.of("/a/b"));
        assertEquals(DocPath.of("a/b").hashCode(), DocPath.of("/a/b/").hashCode());
        assertFalse(DocPath.of("a/b").equals(DocPath.of("a")));
    }
}
