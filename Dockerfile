# Multi-stage build optimized for Google Cloud Run

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build application
RUN npm run build

# Stage 3: Runner (optimized for Cloud Run)
FROM node:20-alpine AS runner
RUN apk add --no-cache dumb-init openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 samuai

# Copy only necessary files
COPY --from=builder --chown=samuai:nodejs /app/dist ./dist
COPY --from=deps --chown=samuai:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=samuai:nodejs /app/package.json ./package.json
COPY --from=builder --chown=samuai:nodejs /app/prisma ./prisma

USER samuai

EXPOSE 8080

# Cloud Run uses HTTP health checks on /health endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health/live', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init for proper signal handling
CMD ["dumb-init", "node", "dist/server.js"]
