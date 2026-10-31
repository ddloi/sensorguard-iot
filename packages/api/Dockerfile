FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/api/package.json packages/api/package.json
COPY packages/simulator/package.json packages/simulator/package.json
COPY packages/dashboard/package.json packages/dashboard/package.json
RUN npm ci --workspace=packages/api --include-workspace-root

COPY packages/api/ packages/api/
RUN npm run build:api && npm prune --omit=dev --workspace=packages/api --include-workspace-root

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=3001
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/api/package.json ./packages/api/package.json
COPY --from=build /app/packages/api/dist ./packages/api/dist
USER node
EXPOSE 3001
CMD ["node", "packages/api/dist/index.js"]
