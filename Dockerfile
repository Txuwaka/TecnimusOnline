FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY docs ./docs
COPY server ./server
USER node
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server/index.cjs"]
