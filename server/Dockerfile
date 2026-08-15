# ==============================================================================
# Server Dockerfile — multi-stage build
#
# Stages:
#   base        — shared Node.js base with package installs
#   development — hot-reload with nodemon (used in docker-compose dev)
#   production  — minimal runtime image
# ==============================================================================

# ── Base stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

WORKDIR /app

# Install OS-level build dependencies required by native Node modules
RUN apk add --no-cache openssl

# Copy manifests first to leverage Docker layer caching
# (only re-runs npm install when package files change)
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npm cache clean --force

# Generate Prisma client — must happen after node_modules are installed
RUN npx prisma generate

# ── Development stage ─────────────────────────────────────────────────────────
FROM base AS development

# Install dev dependencies (nodemon, etc.) for hot-reload
RUN npm ci && npm cache clean --force

COPY . .

EXPOSE 5000

# Run migrations then start with nodemon for hot-reload
CMD ["sh", "-c", "npx prisma migrate deploy && node --experimental-vm-modules node_modules/.bin/nodemon src/server.js"]

# ── Production stage ──────────────────────────────────────────────────────────
FROM base AS production

COPY . .

# Run as a non-root user to reduce attack surface
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
