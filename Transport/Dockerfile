# Transport web (same SPA, includes /transport routes)
# Builds the root Vite app and serves with nginx.

FROM node:20-alpine AS builder
WORKDIR /app

# Build-time env (Vite bakes these into the bundle)
ARG VITE_API_URL
ARG VITE_TRANSPORT_ADMIN_SECRET
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_TRANSPORT_ADMIN_SECRET=${VITE_TRANSPORT_ADMIN_SECRET}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
COPY Transport/nginx.transport.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

