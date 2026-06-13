# ConnectWave — Railway production image (signaling server + optional bundled Redis)
FROM node:22-alpine AS client-build

WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client ./
RUN npm run build

FROM node:22-alpine AS production

RUN apk add --no-cache dumb-init redis wget

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server ./server
RUN npm ci --prefix server --omit=dev

COPY --from=client-build /client/dist ./client/dist
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-4000}/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["/docker-entrypoint.sh"]
