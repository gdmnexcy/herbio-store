FROM oven/bun:1
WORKDIR /app
COPY package.platform.json ./package.json
RUN bun install --production
COPY platform-server.ts ./platform-server.ts
COPY db ./db
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "run", "platform-server.ts"]
