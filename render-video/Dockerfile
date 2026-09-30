# Servicio de render de Marta (Remotion). Contenedor PROPIO: no toca n8n,
# Postgres, Redis ni Nginx. Ver README.md.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev libxfixes3 \
    libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 fonts-noto-color-emoji ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . .
RUN npx remotion browser ensure
ENV NODE_ENV=production PORT=3900
EXPOSE 3900
USER node
CMD ["node", "servidor.mjs"]
