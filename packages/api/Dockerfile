FROM node:22-alpine
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./

# Copy api package files
COPY packages/api/package.json packages/api/

# Install dependencies
RUN npm install --workspace=packages/api --include-workspace-root

# Copy source code
COPY packages/api/ packages/api/

# Build TypeScript
RUN npm run build -w packages/api

# Expose API port
EXPOSE 3001

# Start the server
CMD ["node", "packages/api/dist/index.js"]
