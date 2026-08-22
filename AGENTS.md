# AGENTS.md

## 0. 总则

本项目为 **Spring Boot 单体架构 + Maven 多模块** 项目。

所有参与本项目开发的人员、AI Agent、代码生成工具，都必须严格遵守本文件中的架构规范、模块规范、命名规范和依赖规则。

如果口头需求、临时讨论、历史代码与本文件冲突，原则上以本文件为准。

如果确实需要调整架构，必须先修改本文件，再修改代码。

---

## 1. 架构定位

本项目采用：

> **模块化单体架构**

当前阶段不拆微服务，但通过 Maven 模块和业务模块内部 `api` 层，保证后续可扩展、可拆分。

核心原则：

1. 单体部署，统一由 `workbench-server` 启动。
2. 业务代码按模块隔离。
3. 公共能力下沉到 `workbench-common`。
4. 框架能力沉淀到 `workbench-framework`。
5. 技术设施沉淀到 `workbench-infrastructure`。
6. 业务模块之间必须通过 `api` 层交互。
7. 禁止跨模块直接访问 `DO`、`mapper`、`service.impl`、`controller`。
8. 禁止在公共模块中写业务逻辑。
9. 禁止在启动模块中写业务逻辑。
10. 架构演进采用渐进式，不允许未经确认随意新增 Maven 模块。

---

## 2. Maven 模块结构

当前项目固定为以下模块：

```text
workbench
├── workbench-common
├── workbench-framework
├── workbench-infrastructure
├── workbench-module-docs
├── workbench-module-XXX业务功能
└── workbench-server