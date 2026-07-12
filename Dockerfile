FROM node:20-slim

WORKDIR /app

# 只複製依賴清單先安裝，利用 layer cache
COPY package.json ./
RUN npm install --omit=dev

# 複製其餘檔案
COPY server.js ./
COPY index.html index-mobile.html README.md ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
