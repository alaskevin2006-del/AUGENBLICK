#!/bin/sh
set -eu
deploy_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
sh "$deploy_dir/compose.sh" exec -T web nginx -t
sh "$deploy_dir/compose.sh" exec -T web nginx -s reload
