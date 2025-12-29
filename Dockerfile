# Minimal runtime using Puppeteer's official base image (includes Chromium & deps)
FROM ghcr.io/puppeteer/puppeteer:latest

WORKDIR /app

# Enable corepack/pnpm and install dependencies first (better layer caching)
ENV PNPM_HOME=/root/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.9.0 --activate

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN pnpm install

# Copy source
COPY . .

# Default: run via tsx (no compile step, simplest path)
CMD ["pnpm", "dev"]
