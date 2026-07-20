FROM node:20-alpine
WORKDIR /app
# .npmrc carries legacy-peer-deps=true, needed for npm ci to resolve the
# @codecov/vite-plugin ↔ vite@8 peer conflict. It must be copied *before*
# npm ci — the later "COPY . ." would be too late.
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
