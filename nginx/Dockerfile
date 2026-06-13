FROM node:20-alpine AS client-build

WORKDIR /client
COPY client/package*.json ./
RUN npm ci

COPY client .
ARG VITE_SERVER_URL
ARG VITE_ROOM_SERVICE_URL
ARG VITE_CHAT_SERVICE_URL
ENV VITE_SERVER_URL=$VITE_SERVER_URL
ENV VITE_ROOM_SERVICE_URL=$VITE_ROOM_SERVICE_URL
ENV VITE_CHAT_SERVICE_URL=$VITE_CHAT_SERVICE_URL
RUN npm run build

FROM nginx:alpine AS production
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=client-build /client/dist /usr/share/nginx/html

EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]
