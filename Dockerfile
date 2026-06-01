# Multi-stage build for production-ready fullstack app
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci

# Copy full application code and build
COPY . .
RUN npm run build

# Production Runner stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Install only production dependencies (excluding devDeps to keep the image slim)
RUN npm ci --omit=dev

EXPOSE 3000

CMD ["npm", "run", "start"]
