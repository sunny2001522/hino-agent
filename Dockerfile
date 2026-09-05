FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY vite.config.js index.html excel-derived-data.js enhancements.js enhancements.css ./
COPY src ./src
RUN npx vite build

FROM node:20-slim
WORKDIR /app
COPY server.js ./
COPY --chown=0:0 lib lib
COPY --from=build /app/dist ./dist
COPY --chown=0:0 pages dist/pages
ENV STATIC_DIR=dist
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
