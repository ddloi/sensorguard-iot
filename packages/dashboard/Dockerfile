FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/api/package.json packages/api/package.json
COPY packages/simulator/package.json packages/simulator/package.json
COPY packages/dashboard/package.json packages/dashboard/package.json
RUN npm ci --workspace=packages/dashboard --include-workspace-root

COPY packages/dashboard/ packages/dashboard/
RUN npm run build:dashboard

FROM nginx:stable-alpine AS runtime
COPY packages/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/dashboard/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
