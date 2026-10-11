FROM node:20-alpine

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm install

# Copy source code
COPY tsconfig*.json ./
COPY packages/ ./packages/
COPY server/ ./server/

# Build shared and server
RUN npm run build:server

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

CMD ["npm", "run", "start:server"]
