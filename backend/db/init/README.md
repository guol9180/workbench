# 数据库初始化脚本

此目录挂载到 MySQL 容器的 `/docker-entrypoint-initdb.d`，**仅在数据卷首次初始化时**按文件名升序自动执行。

- 命名约定：`V<序号>__<描述>.sql`（如 `V1__blog_schema.sql`），保证执行顺序
- 变更已初始化数据库的结构请手动执行 SQL（本项目未引入 Flyway，引入后脚本迁移至其管理）
- 本地开发同样生效：`docker compose -f docker-compose.dev.yml up -d`
