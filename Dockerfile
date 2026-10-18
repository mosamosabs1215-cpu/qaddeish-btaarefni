FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json .
COPY server.mjs .
COPY public ./public
RUN mkdir -p /app/data
ENV PORT=3000
EXPOSE 3000
CMD ["node","server.mjs"]
