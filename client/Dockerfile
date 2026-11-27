# syntax=docker/dockerfile:1
# (the line above enables the COPY <<EOF used for the nginx config below)

# ---------- build: compile the static production files into /app/dist ----------
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Vite writes VITE_* values into the JavaScript at build time, so the API URL must be
# passed when building, e.g. --build-arg VITE_API_URL=https://api.staging.example.com
# (setting it on the running container has no effect)
ARG VITE_API_URL
RUN test -n "$VITE_API_URL" || (echo "VITE_API_URL build argument is required" && exit 1)
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---------- production: serve the static files with nginx ----------
# Build with: docker build --target production --build-arg VITE_API_URL=... client
# This image runs nginx as a non-root user on port 8080 (Code Engine's default port).
FROM nginxinc/nginx-unprivileged:stable-alpine AS production
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 8080;
    root /usr/share/nginx/html;

    location / {
        # Paths like /project/7 aren't files: send them to index.html so React Router handles them
        # (without this, reloading or opening a direct link returns 404)
        try_files $uri /index.html;
        # index.html must always be fetched fresh so users get new builds straight away
        add_header Cache-Control "no-cache";
    }

    location /assets/ {
        # Vite gives built files unique names, so they can be cached for a long time
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
EOF
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080

# ---------- dev: Vite dev server for local development ----------
# Kept as the LAST stage so it's what gets built when no --target is given,
# which is how compose.yaml builds the client
FROM node:22-slim AS dev
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
