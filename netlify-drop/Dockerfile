# MediaDrop 24/7 Cloud Dockerfile (Render / Railway / Koyeb)
FROM node:22-alpine

# Install Python, ffmpeg, and yt-dlp for full multi-platform support
RUN apk add --no-cache python3 py3-pip ffmpeg && \
    python3 -m pip install --no-cache-dir -U yt-dlp --break-system-packages

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev || true

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
