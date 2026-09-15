# syntax=docker/dockerfile:1

# ---- ビルド ----
# フロントを固めるためだけのステージ。ここで入れた node_modules は実行側に持ち込まない。
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build


# ---- 実行 ----
# サーバーは node:http と node:sqlite だけで書いてあるので依存パッケージが無い。
# ビルド成果物とサーバーのソースだけを置く。
FROM node:24-alpine AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5174 \
    MO_DB=/app/data/math-organizer.db

WORKDIR /app

COPY package.json ./
COPY server ./server
COPY --from=build /app/dist ./dist

# DB とトークンの置き場。ボリュームを当てなくても起動はできるようにしておく。
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 5174

# 起動確認は認証不要の /api/health で行う
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5174)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
