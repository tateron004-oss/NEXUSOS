FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY public ./public
COPY scripts ./scripts
COPY README.md PRODUCTION_READINESS.md .env.example ./

ENV NODE_ENV=production
ENV PORT=4288
ENV NEXUSOS_WORKSPACE_DIR=/app/workspace
ENV NEXUSOS_DATA_DIR=/app/data
EXPOSE 4288

CMD ["node", "server.js"]
