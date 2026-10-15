package com.imhgl.workbench.docs.model;

import java.util.Locale;

/**
 * 文档相对路径值对象：归一化与安全校验的唯一入口（规范见 AGENTS.md 3.4）。
 * <p>非法路径（穿越段、盘符绝对路径、空段、点段、空字节）造不出实例；
 * service 层一律以 DocPath 流转，api/controller 边界收 String。
 */
public record DocPath(String value) {

    public static final DocPath ROOT = new DocPath("");

    public DocPath {
        String v = value == null ? "" : value.replace('\\', '/').trim();
        while (v.startsWith("/")) {
            v = v.substring(1);
        }
        while (v.endsWith("/")) {
            v = v.substring(0, v.length() - 1);
        }
        if (!v.isEmpty()) {
            // 冒号在 Windows 文件名中非法且会连带覆盖盘符写法（C:/x）——在值对象统一拒绝，
            // 而不是落到文件系统层抛出英文的 InvalidPathException，保证错误消息语言一致
            if (v.contains("\0") || v.indexOf(':') >= 0) {
                throw new IllegalArgumentException("非法路径：" + value);
            }
            for (String seg : v.split("/")) {
                if (seg.isEmpty() || seg.equals(".") || seg.equals("..")) {
                    throw new IllegalArgumentException("非法路径：" + value);
                }
            }
        }
        value = v;
    }

    public static DocPath of(String raw) {
        return new DocPath(raw);
    }

    public boolean isRoot() {
        return value.isEmpty();
    }

    /** 末段名称；根为空串 */
    public String name() {
        int i = value.lastIndexOf('/');
        return i < 0 ? value : value.substring(i + 1);
    }

    /** 扩展名（小写，不含点；无点为空串） */
    public String extension() {
        String n = name();
        int dot = n.lastIndexOf('.');
        return dot < 0 ? "" : n.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    /** 拼接子路径 */
    public DocPath resolve(String child) {
        DocPath c = DocPath.of(child);
        if (c.isRoot()) {
            return this;
        }
        return isRoot() ? c : new DocPath(value + "/" + c.value);
    }

    @Override
    public String toString() {
        return value;
    }
}
