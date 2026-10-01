#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

: "${VPS_HOST:?Debes definir VPS_HOST, ej: VPS_HOST=xxx.xxx.xxx.xxx npm run db:pull-prod}"
VPS_USER="${VPS_USER:-ubuntu}"
VPS_APP_DIR="${VPS_APP_DIR:-~/quini-api}"

echo "Esto BORRA los datos locales de Postgres y los sustituye por los de producción ($VPS_HOST)."
read -r -p "Escribe 'si' para confirmar: " CONFIRM
if [ "$CONFIRM" != "si" ]; then
  echo "Cancelado."
  exit 1
fi

echo "Volcando producción y restaurando en local..."
ssh "$VPS_USER@$VPS_HOST" \
  "cd $VPS_APP_DIR && docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres pg_dump -U quini -Fc quini" \
  | docker compose -f docker/docker-compose.yml exec -T postgres \
    pg_restore -U quini -d quini --clean --if-exists

echo "Listo: la base local ahora tiene los datos de producción."
