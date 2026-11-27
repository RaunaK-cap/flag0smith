# Bun installs the packages, Node runs the agent.
# (Node's fetch falls back to IPv4 when IPv6 is broken; Bun's fetch can hang.)
FROM oven/bun:1.3 AS install
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY packages ./packages
COPY apps/agent ./apps/agent
COPY apps/simulator ./apps/simulator
RUN bun install --frozen-lockfile --production

FROM node:24-slim
WORKDIR /app
COPY --from=install /app ./
EXPOSE 4000
CMD ["apps/agent/node_modules/.bin/tsx", "apps/agent/src/index.ts"]
