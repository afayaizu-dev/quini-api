# ---- deps: todas las dependencias (incluidas dev, hacen falta para compilar) ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g npm@12.0.2
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---- build: compila TypeScript a dist/ ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- runtime: solo lo necesario para ejecutar en producción ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g npm@12.0.2

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/dist ./dist
COPY drizzle ./drizzle
COPY openapi ./openapi


USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/src/server.js"]