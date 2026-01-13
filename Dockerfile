# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

# install deps
COPY package*.json ./
RUN npm ci

# build
COPY . .
RUN npm run build

# ---------- runtime stage ----------
FROM nginx:alpine
# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: custom nginx config (recommended for SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
