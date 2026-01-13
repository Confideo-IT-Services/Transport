# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Set API URL to ALB DNS - MUST be before npm run build
ENV VITE_API_URL=http://Allpulse-ALB-1146884340.ap-south-1.elb.amazonaws.com/api

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]