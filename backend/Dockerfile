FROM node:20-slim

# Install dependencies for sharp
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]