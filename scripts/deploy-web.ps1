# Builds the web app, pushes the image to Docker Hub and swaps ONLY the web container on the droplet.
# The API and the databases are not touched. If the new web container is not healthy, the previous
# image is put back automatically.
#
#   cd C:\Repos\hotelnova
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-web.ps1
#
# Optional: -Tag pos-ops-20261013  -Repo touchabesha/restaurantfnb-web  -Droplet root@139.59.239.198  -SkipBuild
param(
  [string]$Repo = "touchabesha/restaurantfnb-web",
  [string]$Tag = ("web-" + (Get-Date -Format "yyyyMMdd-HHmm")),
  [string]$Droplet = "root@139.59.239.198",
  [string]$AppDir = "/opt/fnbnova",
  [switch]$SkipBuild
)
$ErrorActionPreference = "Stop"
$Image = "${Repo}:${Tag}"

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Run($exe, [string[]]$arguments) {
  & $exe @arguments
  if ($LASTEXITCODE -ne 0) { throw "$exe $($arguments -join ' ') failed (exit $LASTEXITCODE)." }
}

Set-Location (Split-Path $PSScriptRoot -Parent)

Step "What this image will contain"
git log --oneline -1
$dirty = git status --porcelain
if ($dirty) {
  Write-Host "Uncommitted changes are INCLUDED in this build:" -ForegroundColor Yellow
  $dirty | ForEach-Object { Write-Host "  $_" }
}
$answer = Read-Host "Deploy $Image to $Droplet ? Type DEPLOY to continue"
if ($answer -ne "DEPLOY") { Write-Host "Cancelled."; exit 1 }

if (-not $SkipBuild) {
  Step "npm run build (i18n, design-system and type checks, then Vite)"
  Run "npm" @("run", "build")
}

Step "docker build $Image"
Run "docker" @("build", "-t", $Image, ".")

Step "docker push $Image"
Run "docker" @("push", $Image)

Step "Swap the web container on the droplet"
$remote = @'
set -euo pipefail
IMAGE="$1"; APP_DIR="$2"
cd "$APP_DIR"
WEB_C="$(docker ps -a --filter label=com.docker.compose.service=web --filter "label=com.docker.compose.project.working_dir=$APP_DIR" --format '{{.ID}}' | head -n 1)"
[ -n "$WEB_C" ] || { echo "No web container of the Compose project in $APP_DIR." >&2; exit 1; }
PROJECT="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$WEB_C")"
FILES="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$WEB_C")"
OLD_IMAGE="$(docker inspect -f '{{ .Config.Image }}' "$WEB_C")"
OLD_ID="$(docker inspect -f '{{ .Image }}' "$WEB_C")"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$APP_DIR/backups"
# Keep the running image under a fixed name so a rollback never depends on the registry.
docker tag "$OLD_ID" "restaurantfnb-web:rollback-$STAMP"
echo "$OLD_IMAGE $OLD_ID" > "$APP_DIR/backups/web-before-$STAMP.txt"
echo "Project $PROJECT | files $FILES | current $OLD_IMAGE"

docker pull "$IMAGE"

OVERRIDE="$APP_DIR/docker-compose.web-image.yml"
args=(); IFS=',' read -r -a list <<< "$FILES"
for f in "${list[@]}"; do [ "$f" = "$OVERRIDE" ] || args+=(-f "$f"); done
args+=(-f "$OVERRIDE")
[ -f "$OVERRIDE" ] && cp "$OVERRIDE" "$APP_DIR/backups/docker-compose.web-image.$STAMP.yml"

swap() { printf 'services:\n  web:\n    image: %s\n' "$1" > "$OVERRIDE"; docker compose -p "$PROJECT" "${args[@]}" up -d --no-deps web; }
healthy() {
  sleep 8
  local c; c="$(docker ps --filter "label=com.docker.compose.project=$PROJECT" --filter label=com.docker.compose.service=web --format '{{.ID}}' | head -n 1)"
  [ -n "$c" ] || return 1
  [ "$(docker inspect -f '{{.State.Running}} {{.RestartCount}}' "$c")" = "true 0" ] || return 1
  docker exec "$c" sh -c 'wget -q -O - http://127.0.0.1/ | grep -qi "<div id=\"root\""'
}

swap "$IMAGE"
if healthy; then
  echo "OK: web now runs $IMAGE"
  echo "Rollback image kept as restaurantfnb-web:rollback-$STAMP"
  echo "NOTE: $OVERRIDE pins the web image. Include it (-f) in future 'docker compose' commands, or remove it to go back to the image in your main compose file."
else
  echo "Web container is not healthy. Rolling back to $OLD_IMAGE." >&2
  swap "restaurantfnb-web:rollback-$STAMP"
  healthy && echo "Rolled back." >&2 || echo "ROLLBACK ALSO UNHEALTHY - check 'docker ps' on the droplet." >&2
  exit 1
fi
'@
$remote = $remote -replace "`r", ""
$remote | ssh $Droplet "bash -s -- '$Image' '$AppDir'"
if ($LASTEXITCODE -ne 0) { throw "Remote step failed (exit $LASTEXITCODE). See the output above." }

Step "Done: $Image is live. Sign in again and open Sales > POS Operations and POS Tables."
