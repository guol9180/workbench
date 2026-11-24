# API 设计约定

> 规范主文件见 [AGENTS.md](../../AGENTS.md)，模块职责见 [modules.md](./modules.md)。

统一包装 `ApiResult{message, code, data}`，`code=0` 成功。

## 认证（双凭据）

- `AUTH_PASSWORD_SHA256`：`POST /api/auth/login` {password} 常量时间比对后签发会话令牌（内存态，默认 168 小时，重启失效）；连续 5 次失败全局锁 60 秒（429 + Retry-After）。
- `API_TOKEN`：机器凭据，供 ingest 静态携带。
- 任一非空 = 认证开启，`/api/**`（`/api/auth/**` 与 Swagger 除外）须带 `X-API-Token`，失败 → 401 + `UNAUTHORIZED(40100)`；两者皆空 = 关闭。
- `POST /api/auth/logout` 失效当前会话。

## 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/monitor/ingest` | 外部流量上报 |
| GET | `/api/monitor/sources` | 来源列表（含 `workbench`） |
| GET | `/api/monitor/overview` | 区间总览（source / range） |
| GET | `/api/monitor/series` | 时序（metric=count/errCount/avgMs/last；可带 endpoint 过滤） |
| GET | `/api/monitor/top-endpoints` | 端点排行（source / range / limit / by） |
| GET | `/api/monitor/recent` | 最近分钟桶（source / limit 1..500） |
| GET | `/api/monitor/status` | 自检（不回显 token） |
| PUT / DELETE | `/api/monitor/settings/github-token` | 页面级 token 设置 / 清除 |
| GET / POST | `/api/monitor/source-configs` | 列表 / 接入 |
| PUT / DELETE | `/api/monitor/source-configs/{id}` | 修改 / 停采集 |
| POST | `/api/monitor/source-configs/{id}/collect` | 手动采集 |
| GET | `/api/monitor/github/repos` | 当前 token 可见仓库（上限 100） |
| GET | `/api/monitor/probe-targets` | 拨测目标列表 |
| POST | `/api/monitor/probe-targets` | 新增拨测目标（name / url / enabled） |
| PUT | `/api/monitor/probe-targets/{id}` | 修改拨测目标 |
| DELETE | `/api/monitor/probe-targets/{id}` | 删除目标（停拨测，历史数据自然过期） |
| POST | `/api/auth/login` | 密码换会话令牌 |
| POST | `/api/auth/logout` | 失效当前会话 |

新端点必须先登记本表再写代码。

## 参数与错误

- 源配置：`type=github`；`repo=owner/name`；`metrics ⊆ {pages, downloads}`；重复 → 400 + `40900`；不存在 → 400 + `40400`；校验失败 → 400 + `40000`。
- 拨测目标：`name` 1..40 字符且不含 `/` 与控制字符；`url` 仅接受 http / https；重名或同 URL → 400 + `40900`；不存在 id → 400 + `40400`；校验失败 → 400 + `40000`。
- 查询：`range` / `metric` / `step` / `by` 非法 → 400 + `40000`；`metric ∈ {count, errCount, avgMs, last}`（last = 快照桶内最后值）；`ts` 为分钟级 epoch 毫秒；错误判定 = status 0（连接失败/超时）或 ≥ 400；`rps` = count / 区间秒数。
- 映射：业务异常 → 400 + 语义码；未知路由 → 404；方法不支持 → 405 + `40500`；校验 / 缺参 → 400 + `40000`；未认证 → 401 + `40100`；未知异常 → 500 + `50000`，不泄漏堆栈与类名。
