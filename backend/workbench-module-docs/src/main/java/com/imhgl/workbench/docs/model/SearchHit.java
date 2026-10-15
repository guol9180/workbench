package com.imhgl.workbench.docs.model;

/**
 * 搜索命中（结构化，替代旧版文本装饰）：
 * fileNameMatch=true 表示文件名命中；line 为首个内容命中行（1 起，仅文件名命中时为 0）；
 * snippet 为内容命中行摘要（超 120 字符截断加 …），仅文件名命中时为文件名。
 */
public record SearchHit(String path, String name, boolean fileNameMatch, int line, String snippet) {
}
