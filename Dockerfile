# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only production artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./

# Directory for SQLite DB (mounted as volume in prod)
RUN mkdir -p /data && chown appuser:appgroup /data

# Directory for TLS cert
RUN mkdir -p /app/certs && chown appuser:appgroup /app/certs

ENV PORT=3000
ENV DB_PATH=/data/contacts.db

EXPOSE 3000

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "src/server.js"]
