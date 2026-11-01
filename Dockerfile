FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js tailwind.config.js postcss.config.js ./
COPY src ./src
COPY server ./server
COPY design ./design
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5173
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/game ./src/game
COPY --from=build /app/src/store ./src/store
COPY --from=build /app/src/data ./src/data
COPY --from=build /app/src/logic ./src/logic
COPY --from=build /app/design ./design
COPY --from=build /app/server ./server
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
USER node
EXPOSE 5173
CMD ["node", "server/start.js"]
