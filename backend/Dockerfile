# Multi-stage build for optimal image size
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies (including devDependencies for build)
RUN npm ci

# Copy source code files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Compile TypeScript
RUN npm run build

# Stage 2: Run environment
FROM node:20-alpine AS runner

WORKDIR /app

# Copy production package files and install only production dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production && npx prisma generate

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create upload directories for local signature fallback uploads
RUN mkdir -p uploads

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
