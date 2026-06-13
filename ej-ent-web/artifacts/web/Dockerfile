# --- STAGE 1: THE BUILDER (Using Debian-slim to guarantee C++ compilation) ---
FROM node:22-slim AS builder

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy the ENTIRE workspace into the container FIRST
COPY . .

# Navigate specifically to the web folder
WORKDIR /app/artifacts/web

# Force CI mode
ENV CI=true

# CRITICAL FIX 1: Ignore the Windows lockfile and fetch true Linux binaries
RUN pnpm install --no-frozen-lockfile

# CRITICAL FIX 2: Build the assets using the Debian glibc architecture
RUN pnpm run build

# --- STAGE 2: THE SERVER (Using Alpine for a tiny, lightning-fast web server) ---
FROM nginx:alpine

# FIX: Point this back to your nested directory path
COPY --from=builder /app/artifacts/web/dist /usr/share/nginx/html

# KEEP THIS LINE: Points to your custom SPA routing configuration
COPY artifacts/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]