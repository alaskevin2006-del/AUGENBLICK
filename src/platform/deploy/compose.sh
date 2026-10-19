#!/bin/sh
# Stable project name and explicit files prevent affecting adjacent deployments.
set -eu
# Keep CLI/build cache isolated from other deployments and root-owned defaults.
export DOCKER_CONFIG="${DOCKER_CONFIG:-/opt/augenblick/shared/docker-config}"
mkdir -p "$DOCKER_CONFIG"
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec docker compose --env-file "${AUGENBLICK_ENV_FILE:-/opt/augenblick/shared/.env}" \
  -p augenblick -f docker-compose.yml -f compose.prebuilt.yml -f compose.tls.yml "$@"
