/**
 * 技术设施（规范见 AGENTS.md 3.3）：中性文件树存储——防路径穿越、扩展名白名单、受控读写。
 * 只产出中性模型（{@link com.imhgl.workbench.infrastructure.storage.StorageNode}）
 * 与中性配置（workbench.storage.*），禁止业务色彩命名与业务规则。
 */
package com.imhgl.workbench.infrastructure;
