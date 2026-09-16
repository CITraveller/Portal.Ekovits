# --- build the static Vite bundle ---
FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_API_URL=https://portal.ekovits.com/api
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# --- serve it with nginx ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
