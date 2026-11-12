# 前端静态产物镜像：Node 构建 → Caddy 运行时（CI 打 v* 标签时构建，tag = frontend）
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv/frontend
