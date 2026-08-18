#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

RETENCION_DIAS=28
FECHA=$(date +%F)
DESTINO="backups"
FICHERO="$DESTINO/quini-$FECHA.dump"

mkdir -p "$DESTINO"

docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U quini -Fc quini > "$FICHERO"

ln -sf "quini-$FECHA.dump" "$DESTINO/latest.dump"

find "$DESTINO" -name 'quini-*.dump' -mtime +"$RETENCION_DIAS" -delete

echo "Backup creado: $FICHERO"