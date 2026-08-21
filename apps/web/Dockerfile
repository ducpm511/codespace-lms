# syntax=docker/dockerfile:1
#
# Web image = Caddy phục vụ `apps/web/dist` + reverse proxy `/api/*` sang container api.
# Cùng một origin nên cookie refresh (sameSite: lax, path /api/auth) chạy nguyên vẹn và
# không cần CORS. Build từ THƯ MỤC GỐC monorepo:
#   docker build -f apps/web/Dockerfile -t lms-web .
#
# CẢNH BÁO RAM: bước vite build (Monaco + Pyodide, dist ~47 MB) ngốn hơn 1 GB. Trên VPS 2 GB
# đang chạy Postgres thì phải có swap, hoặc build ở CI rồi push image — xem docs/RUNBOOK.md.

FROM node:20-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json turbo.json ./
COPY packages/contracts packages/contracts
COPY apps/web apps/web

RUN pnpm --filter @lms/contracts build && pnpm --filter @lms/web build

FROM caddy:2-alpine AS runtime
COPY --from=build /repo/apps/web/dist /srv
COPY ops/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443
