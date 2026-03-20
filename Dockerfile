# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Set dummy env vars for build (prisma.config.ts needs them)
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy \
    PULUMI_CONFIG_PASSPHRASE=dummy \
    PULUMI_BACKEND_URL=s3://dummy \
    AWS_ACCESS_KEY_ID=dummy \
    AWS_SECRET_ACCESS_KEY=dummy \
    AWS_REGION=dummy \
    PROXMOX_ENDPOINT=https://dummy:8006 \
    PROXMOX_API_TOKEN_ID=dummy \
    PROXMOX_API_TOKEN_SECRET=dummy \
    PROXMOX_NODE=dummy \
    PROXMOX_TEMPLATE_VM_ID=9000 \
    PROXMOX_DATASTORE_ID=dummy

# Generate Prisma client and build TypeScript
RUN npm run prisma:generate && npm run build

# Production stage
FROM node:20-alpine AS production

# Install curl for healthchecks and Pulumi CLI
RUN apk add --no-cache curl bash

# Install Pulumi CLI
RUN curl -fsSL https://get.pulumi.com | sh
ENV PATH="/root/.pulumi/bin:${PATH}"

# Create app directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy Pulumi to nodejs user
RUN mkdir -p /home/nodejs/.pulumi && \
    cp -r /root/.pulumi/bin /home/nodejs/.pulumi/ && \
    chown -R nodejs:nodejs /home/nodejs/.pulumi

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist /app/dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json /app/package.json
COPY --from=builder --chown=nodejs:nodejs /app/prisma /app/prisma
COPY --from=builder --chown=nodejs:nodejs /app/src/generated /app/src/generated

# Switch to non-root user
USER nodejs

# Set Pulumi path for nodejs user
ENV PATH="/home/nodejs/.pulumi/bin:${PATH}"

# Expose port
EXPOSE 8000

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/server.js"]
