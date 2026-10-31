FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/api/package.json packages/api/package.json
COPY packages/simulator/package.json packages/simulator/package.json
COPY packages/dashboard/package.json packages/dashboard/package.json
RUN npm ci --workspace=packages/simulator --include-workspace-root

COPY packages/simulator/ packages/simulator/
RUN npm run build:simulator && npm prune --omit=dev --workspace=packages/simulator --include-workspace-root

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/simulator/package.json ./packages/simulator/package.json
COPY --from=build /app/packages/simulator/dist ./packages/simulator/dist
USER node
CMD ["node", "packages/simulator/dist/index.js"]
