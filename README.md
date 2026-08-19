# 工作台 · 在线 Markdown 文档系统

一个可部署在服务器上的个人文档系统，用浏览器随时记录、查看工作内容，无需安装任何 Markdown 软件。手机、电脑均可访问。

## 功能

- **文档管理**：新建 / 编辑 / 重命名 / 删除文档与文件夹，文件树浏览
- **Markdown 编辑**：所见即所得 + 分屏预览 + 大纲导航（Vditor 编辑器），`Ctrl+S` 保存
- **今日工作**：一键创建 / 打开按日期组织的日志（`日志/2026-08/2026-08-19.md`）
- **打开本地文件**：在网页中选择或拖拽本地 `.md` 文件直接预览（文件不离开浏览器），可一键导入文档库
- **全文搜索**：按文件名和内容搜索
- **密码登录**：简单会话保护，移动端体验友好
- **移动端适配**：手机上侧边栏收为抽屉，触屏可用

文档以 `.md` 纯文本形式保存在服务端目录中，可随时拷贝备份、用其他软件打开。

## 本地运行

要求：JDK 21+、Maven 3.8+

```bash
mvn spring-boot:run
```

或 Windows 下双击 `start.bat`。

启动后浏览器访问 <http://localhost:8080>，默认密码 `workbench123`。

## 配置

全部配置支持环境变量覆盖，部署时无需改代码：

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `SERVER_PORT` | `8080` | 服务端口 |
| `APP_PASSWORD` | `workbench123` | 登录密码（**部署后务必修改**） |
| `DOCS_ROOT` | `./data/docs` | 文档库存储目录（建议指向持久化路径） |

## 服务器部署

### 方式一：jar 部署

```bash
mvn package -DskipTests
APP_PASSWORD=你的密码 DOCS_ROOT=/var/workbench/docs java -jar target/workbench-1.0-SNAPSHOT.jar
```

建议配合 systemd 管理（示例 `workbench.service`）：

```ini
[Unit]
Description=Workbench Docs
After=network.target

[Service]
Environment=APP_PASSWORD=你的密码
Environment=DOCS_ROOT=/var/workbench/docs
ExecStart=/usr/bin/java -jar /opt/workbench/workbench-1.0-SNAPSHOT.jar
Restart=always

[Install]
WantedBy=multi-user.target
```

### 方式二：Docker 部署（推荐）

```bash
# 修改 docker-compose.yml 中的 APP_PASSWORD 后：
docker compose up -d --build
```

文档数据保存在 `workbench-docs` 数据卷中；也可将卷换成宿主机目录直接挂载。

## 数据与备份

所有文档就是普通 `.md` 文件，直接拷贝 `DOCS_ROOT` 指向的目录即可完成备份。

## 安全说明

- 所有路径操作均校验位于文档库目录内，防止路径穿越
- 未登录访问任何 `/api/**` 接口均返回 401
- 本地文件预览完全在浏览器中完成，不上传到服务器（除非主动导入）
