# syntax=docker/dockerfile:1.7

# --- Frontend build ---------------------------------------------------------
FROM node:20-slim AS frontend
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
# VITE_GOOGLE_CLIENT_ID is baked into the bundle; provide it at build time.
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_ADMIN_AUTH_BYPASS
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_ADMIN_AUTH_BYPASS=$VITE_ADMIN_AUTH_BYPASS
RUN pnpm build

# --- Backend build ----------------------------------------------------------
FROM node:20-slim AS backend
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --frozen-lockfile
COPY server/tsconfig.json ./server/tsconfig.json
COPY server/src ./server/src
RUN pnpm --dir server build

# --- Runtime ----------------------------------------------------------------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
RUN pnpm install --prod --frozen-lockfile --filter dice-10000-server
# Frontend bundle
COPY --from=frontend /app/dist ./dist
# Backend bundle
COPY --from=backend /app/server/dist ./server/dist
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server/dist/index.js"]
