# syntax=docker/dockerfile:1.7

# --- Frontend build ---------------------------------------------------------
FROM node:20-slim AS frontend
WORKDIR /app
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile
COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
# VITE_GOOGLE_CLIENT_ID is baked into the bundle; provide it at build time.
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN yarn build

# --- Backend build ----------------------------------------------------------
FROM node:20-slim AS backend
WORKDIR /app/server
COPY server/package.json server/yarn.lock* ./
RUN corepack enable && yarn install
COPY server/tsconfig.json ./
COPY server/src ./src
RUN yarn build

# --- Runtime ----------------------------------------------------------------
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Frontend bundle
COPY --from=frontend /app/dist ./dist
# Backend bundle + its node_modules
COPY --from=backend /app/server/dist ./server/dist
COPY server/package.json server/yarn.lock* ./server/
RUN cd server && corepack enable && yarn install --production
EXPOSE 8080
ENV PORT=8080
CMD ["node", "server/dist/index.js"]
