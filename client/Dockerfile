# client/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# VITE_SERVER_URL is injected at build time via --build-arg
ARG VITE_SERVER_URL=http://localhost:4000
ENV VITE_SERVER_URL=$VITE_SERVER_URL

RUN npm run build

# Production stage: serve the static build with nginx
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA routing (react-router needs this)
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
