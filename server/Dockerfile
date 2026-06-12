# server/Dockerfile
FROM node:20-alpine AS base

# Install dumb-init so that Node.js isn't PID 1
# (PID 1 doesn't receive SIGTERM properly in containers without it)
RUN apk add --no-cache dumb-init

WORKDIR /app

# Copy dependency manifests first so Docker layer cache reuses
# the npm install layer when only source files change
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
