FROM node:22-alpine
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./

# Copy simulator package files
COPY packages/simulator/package.json packages/simulator/

# Install dependencies
RUN npm install --workspace=packages/simulator --include-workspace-root

# Copy source code
COPY packages/simulator/ packages/simulator/

# Build TypeScript
RUN npm run build -w packages/simulator

# Start the simulator
CMD ["node", "packages/simulator/dist/index.js"]
