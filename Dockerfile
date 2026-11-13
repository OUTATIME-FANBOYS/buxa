# syntax=docker/dockerfile:1

# ---- build: compile the web app and bundle the API ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Public Supabase settings are baked into the web bundle at build time. They are not secrets (publishable key only).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
RUN npm run build

# ---- runtime: production dependencies plus the built output, as a non-root user ----
FROM node:22-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8788 STATIC_DIR=/app/web MIGRATIONS_DIR=/app/migrations
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist-api ./dist-api
COPY --from=build /app/apps/web/dist ./web
COPY packages/db/migrations ./migrations
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh && chown -R node:node /app
USER node
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
