#!/bin/sh
# Stable project name and explicit files prevent affecting adjacent deployments.
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec docker compose --env-file "${AUGENBLICK_ENV_FILE:-/opt/augenblick/shared/.env}" \
  -p augenblick -f docker-compose.yml -f compose.prebuilt.yml -f compose.tls.yml "$@"
