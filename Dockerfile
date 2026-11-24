FROM oven/bun:1
WORKDIR /app
COPY index.ts ./index.ts
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "run", "index.ts"]
