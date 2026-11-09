FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg chromium ca-certificates fonts-liberation && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY tsconfig.json ./
COPY src ./src
RUN npm install --no-save typescript && npx tsc -p tsconfig.json
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/index.js"]