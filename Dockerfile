FROM oven/bun:1.3
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY packages ./packages
COPY apps/agent ./apps/agent
COPY apps/simulator ./apps/simulator
RUN bun install --frozen-lockfile --production
EXPOSE 4000
CMD ["bun", "apps/agent/src/index.ts"]
