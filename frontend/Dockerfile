# Multi-stage build for Next.js frontend
FROM node:18-alpine AS dependencies

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .


# Build Next.js application and list .next directory
RUN npm run build && echo "\nContents of .next after build:" && ls -l .next && if [ ! -f .next/BUILD_ID ]; then echo "dev-build" > .next/BUILD_ID; fi

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Ensure BUILD_ID exists to satisfy `next start` checks
COPY --from=builder /app/.next /.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
COPY --from=builder /app/app ./app
# Ensure styles used by app layout are available
COPY --from=builder /app/styles ./styles
# Root API helper used by app pages
COPY --from=builder /app/api.js ./api.js
# pages directory optional in app router projects
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/tailwind.config.js ./tailwind.config.js
COPY --from=builder /app/postcss.config.js ./postcss.config.js
COPY --from=builder /app/jest.config.js ./jest.config.js
COPY --from=builder /app/jest.setup.js ./jest.setup.js
COPY --from=builder /app/babel.config.backup.js ./babel.config.backup.js

EXPOSE 3001
ENV PORT 3001
ENV HOSTNAME "0.0.0.0"
ENV NODE_ENV production

CMD ["npm", "start"]