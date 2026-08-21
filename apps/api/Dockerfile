# syntax=docker/dockerfile:1
#
# API image. Build từ THƯ MỤC GỐC monorepo (context = repo root), không phải apps/api:
#   docker build -f apps/api/Dockerfile -t lms-api .
#
# Dùng bookworm-slim chứ không phải alpine: Prisma cần OpenSSL/glibc, engine trên musl
# hay lỗi khó đoán — 40 MB image chênh lệch không đáng đổi lấy rủi ro đó.

# ─────────────────────────── deps ───────────────────────────
FROM node:20-bookworm-slim AS deps
WORKDIR /repo
# openssl phải có Ở ĐÂY, không chỉ ở runtime: `prisma generate` chọn query engine theo phiên bản
# OpenSSL nó DÒ ĐƯỢC lúc build. Thiếu openssl thì nó đoán debian-openssl-1.1.x, còn container
# chạy thật là 3.0.x -> app chết lúc khởi động vì "could not locate the Query Engine".
RUN corepack enable \
  && apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Chỉ copy manifest trước để lớp cache dependency không vỡ mỗi lần sửa code.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/database/package.json packages/database/
# Lọc theo @lms/api và các package nó phụ thuộc. Không lọc thì pnpm cài cả dependency của web
# (monaco-editor 24 MB, pyodide 13 MB, react...) vào ảnh API — vô ích và làm ảnh phình gấp đôi.
RUN pnpm install --frozen-lockfile --filter "@lms/api..."

# ─────────────────────────── build ──────────────────────────
FROM deps AS build
WORKDIR /repo
COPY tsconfig.base.json turbo.json ./
COPY packages/contracts packages/contracts
COPY packages/database packages/database
COPY apps/api apps/api

# prisma generate chạy LÚC BUILD — image chạy thật không cần Prisma CLI.
RUN pnpm --filter @lms/database generate \
  && pnpm --filter @lms/contracts build \
  && pnpm --filter @lms/api build

# Bỏ devDependencies khỏi node_modules trước khi mang sang runtime.
RUN pnpm prune --prod

# ────────────────────────── runtime ─────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production
# Trần heap 384 MB: ngân sách RAM của VPS 2 GB (xem HANDOFF_P9 "Ngân sách RAM").
# Không đặt thì V8 tự chọn theo RAM máy và Node sẽ ăn tới lúc OOM-killer ra tay.
ENV NODE_OPTIONS=--max-old-space-size=384

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

# --chown=node:node: Prisma CLI kiểm tra quyền GHI vào thư mục engine của chính nó lúc khởi
# động; file thuộc root thì `migrate deploy` hỏng ngay ở bước release.
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
# Cả cây packages (kèm node_modules của từng package): trong đó có Prisma CLI để chạy
# `migrate deploy` lúc release, cùng schema + thư mục migrations.
COPY --from=build --chown=node:node /repo/packages ./packages
COPY --from=build --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/package.json

USER node
WORKDIR /repo/apps/api
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/main.js"]
