FROM node:22-alpine AS builder
WORKDIR /app

ARG VITE_KEYCLOAK_URL="https://atlas.neuralworks.lk"
ARG VITE_KEYCLOAK_REALM="forge-atlas"
ARG VITE_KEYCLOAK_CLIENT_ID="forge-atlas-backoffice"
ARG VITE_API_BASE_URL=""

ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/app ./app

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "node_modules/vinext/dist/cli.js", "start", "-p", "3000", "-H", "0.0.0.0"]
