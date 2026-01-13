<# 
deploy-admin-portal-docker.ps1
- Creates Dockerfile + nginx.conf (SPA routing) if missing
- Builds image
- Runs container on http://localhost:5173
#>

param(
  [string]$ProjectPath = (Get-Location).Path,
  [string]$ImageName = "hotelnova-admin",
  [string]$Tag = "latest",
  [string]$ContainerName = "hotelnova-admin",
  [int]$HostPort = 5173,
  [int]$ContainerPort = 80,
  [string]$ViteApiBaseUrl = ""   # optional build-time Vite env
)

$ErrorActionPreference = "Stop"

function Assert-Command([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $name. Please install it and retry."
  }
}

Assert-Command "docker"

if ([string]::IsNullOrWhiteSpace($ProjectPath)) {
  $ProjectPath = (Get-Location).Path
}

Write-Host "==> Using project path: $ProjectPath"
Set-Location $ProjectPath

# Basic checks
if (-not (Test-Path ".\package.json")) {
  throw "package.json not found in: $ProjectPath. Run this script from your React app root."
}

# Create nginx.conf (SPA routing)
$nginxConfPath = Join-Path $ProjectPath "nginx.conf"
if (-not (Test-Path $nginxConfPath)) {
@"
server {
  listen 80;
  server_name _;

  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
"@ | Set-Content -Path $nginxConfPath -Encoding UTF8
  Write-Host "✅ Created nginx.conf"
} else {
  Write-Host "ℹ️ nginx.conf already exists"
}

# Create Dockerfile
$dockerfilePath = Join-Path $ProjectPath "Dockerfile"
if (-not (Test-Path $dockerfilePath)) {
@"
# ---------- build stage ----------
FROM node:20-alpine AS build
WORKDIR /app

# optional build args for Vite (compile-time)
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=\$VITE_API_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------- runtime stage ----------
FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
"@ | Set-Content -Path $dockerfilePath -Encoding UTF8

  Write-Host "✅ Created Dockerfile"
} else {
  Write-Host "ℹ️ Dockerfile already exists"
}

# Stop/remove existing container if present
$existing = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $ContainerName }
if ($existing) {
  Write-Host "==> Removing existing container: $ContainerName"
  docker rm -f $ContainerName | Out-Null
}

# Build image
$imageFull = "$ImageName`:$Tag"
Write-Host "==> Building image: $imageFull"

$buildArgs = @()
if (-not [string]::IsNullOrWhiteSpace($ViteApiBaseUrl)) {
  Write-Host "==> Passing VITE_API_BASE_URL build arg: $ViteApiBaseUrl"
  $buildArgs += @("--build-arg", "VITE_API_BASE_URL=$ViteApiBaseUrl")
}

docker build @buildArgs -t $imageFull .

# Run container
Write-Host "==> Running container: $ContainerName on http://localhost:$HostPort"
docker run -d --name $ContainerName -p "$HostPort`:$ContainerPort" $imageFull | Out-Null

Write-Host "✅ Deployed!"
docker ps --filter "name=$ContainerName"
Write-Host "Open: http://localhost:$HostPort"
