#!/usr/bin/env bash
# Recreate the local hot-reload pdm-backend from docker-compose.yml.
#
# Precondition (one-time, per infra lifecycle): toolkit e2e tests already
# ran (setup.test.ts + setup-org.test.ts) so all pdm-* infra containers
# (peer, ca, dragonfly, oauth2proxy-pdm, keycloak realm=pdm, pdm-backend...)
# are up.
#
# What it does, every run:
#   1. Dumps env from the currently running pdm-backend (the toolkit's, or
#      this script's own from a previous run) into .env.pdm.runtime.
#   2. docker compose down (safe no-op if nothing is up).
#   3. docker compose up -d --build.
#   4. Asks whether to copy the local ../toolkit build into the container's
#      node_modules (npm ci in the image install always pulls the published
#      toolkit from the registry, wiping any local dev patch - see
#      .claude/implemente-search.md).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SRC="pdm-backend"
OUT="$ROOT/.env.pdm.runtime"

if docker inspect "$SRC" >/dev/null 2>&1; then
  docker inspect "$SRC" --format '{{range .Config.Env}}{{println .}}{{end}}' \
    | grep -vE '^(HOSTNAME|HOME|PATH|PWD|NODE_VERSION|YARN_VERSION|NPM_CONFIG_LOGLEVEL|WORKDIR|TERM|LANG|SHLVL|_)=' \
    | sed 's/\$/$$/g' \
    > "$OUT"
  echo "wrote $OUT ($(wc -l <"$OUT") lines)"
fi

docker compose down

if docker inspect "$SRC" >/dev/null 2>&1; then
  echo "removing existing $SRC container (may belong to a different compose project)"
  docker rm -f "$SRC"
fi

docker compose up -d --build

TOOLKIT_LIB="$ROOT/../toolkit/lib"
read -rp "Copy local toolkit build ($TOOLKIT_LIB) into $SRC's node_modules? [y/N] " REPLY
if [[ "$REPLY" =~ ^[Yy]$ ]]; then
  if [ ! -d "$TOOLKIT_LIB" ]; then
    echo "no toolkit build found at $TOOLKIT_LIB (run 'npm run build' in ../toolkit first)" >&2
    exit 1
  fi
  docker exec "$SRC" sh -c "rm -rf /lavajet-backend/node_modules/@bagacito/lavajet-toolkit/lib && mkdir -p /lavajet-backend/node_modules/@bagacito/lavajet-toolkit/lib"
  docker cp "$TOOLKIT_LIB/." "$SRC:/lavajet-backend/node_modules/@bagacito/lavajet-toolkit/lib"
  docker restart "$SRC"
  echo "copied local toolkit build into $SRC and restarted it"
fi
