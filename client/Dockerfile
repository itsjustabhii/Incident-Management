# ==============================================================================
# Client Dockerfile — multi-stage build
#
# Stages:
#   development  — Vite dev server with hot-reload
#   builder      — production Vite build
#   production   — nginx serving the built SPA
# ==============================================================================

# ── Development stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .

EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── Builder stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .

# Vite build produces /app/dist
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM nginx:alpine AS production

# Copy the production build into the nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy the custom nginx configuration
COPY ../docker/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
