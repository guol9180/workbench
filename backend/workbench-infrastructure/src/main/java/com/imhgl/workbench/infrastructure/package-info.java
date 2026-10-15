/**
 * 技术设施（规范见 AGENTS.md 3.3）：中性文件树存储——防路径穿越、扩展名白名单、受控读写。
 * 受控入口即 {@link com.imhgl.workbench.infrastructure.storage.FileTreeStorage} 的公共方法；
 * 状态类失败抛中性的 {@link com.imhgl.workbench.infrastructure.storage.StorageException}（由业务模块翻译），
 * 非法输入抛 IllegalArgumentException。只产出中性模型
 * （{@link com.imhgl.workbench.infrastructure.storage.StorageNode}）与中性配置（workbench.storage.*），
 * 禁止业务色彩命名与业务规则。
 */
package com.imhgl.workbench.infrastructure;
