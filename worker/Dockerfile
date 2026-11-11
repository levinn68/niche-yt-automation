FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg chromium ca-certificates fonts-liberation && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production
# Keep the Node/V8 heap from consuming the entire 1 GB worker container.
ENV NODE_OPTIONS="--max-old-space-size=512 --max-semi-space-size=16 --expose-gc"
EXPOSE 8080
CMD ["npm", "start"]