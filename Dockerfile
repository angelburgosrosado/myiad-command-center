# Dockerfile — Multi-Target Container for Render, Google Cloud Run (myiad-comic-app cluster), or VPS (34.148.244.49)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/sql ./sql
EXPOSE 10000
CMD ["node", "dist/server.cjs"]
