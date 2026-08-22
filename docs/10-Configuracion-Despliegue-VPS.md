# 10 — Configuración del despliegue en VPS

> Documento de seguimiento (no de aprendizaje ni de especificación): registra el estado real del aprovisionamiento del VPS para F12 (`docs/00-Plan-inicial.md` §15), qué se ha hecho, con qué valores concretos, y qué queda pendiente. Se actualiza a medida que se avanza — no es una foto fija.

## Estado actual

**F12 está cerrado del todo, sin nada pendiente.** Servidor, DNS, HTTPS real, primer despliegue manual, despliegue automático vía GitHub Actions, backups con restauración probada, y login con Google — todo hecho y verificado en producción.

- [x] VPS contratado y aprovisionado
- [x] Dominio registrado y DNS apuntando al VPS
- [x] Acceso SSH configurado (clave, sin contraseña) + copia de seguridad de la clave
- [x] Hardening del servidor: firewall, `fail2ban`, SSH solo por clave
- [x] Docker instalado y verificado en el servidor
- [x] `docker-compose.prod.yml`, `Caddyfile` y `.env.prod` preparados
- [x] Primer despliegue (migrar → arrancar → crear admin → verificar)
- [x] `.github/workflows/deploy.yml` (despliegues sucesivos automáticos, probado de extremo a extremo)
- [x] CI (`ci.yml`) verificado en verde de verdad (llevaba días fallando sin que nadie se diera cuenta — ver §4)
- [x] Verificación de HTTPS real con certificado válido (Let's Encrypt, `SSL certificate verify ok`)
- [x] Backups propios (`docker/backup.sh` + cron semanal) y restauración probada de verdad (`pg_restore` en base de pruebas, datos recuperados correctamente)
- [x] Login con Google en producción (cliente OAuth dedicado `quini-api-prod`, verificado de extremo a extremo)

---

## 1. Datos del entorno

| Dato                     | Valor                                                                                                                                                                                                                            |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proveedor VPS            | OVHcloud                                                                                                                                                                                                                         |
| Plan                     | VPS-1 2027 (2 vCores, 4 GB RAM, 40 GB SSD NVMe)                                                                                                                                                                                  |
| Motivo del plan          | El VPS-2 2027 (8GB/4vCPU) estaba sobredimensionado para un entorno sin tráfico de producción real; el presupuesto de memoria recalculado (API + Postgres + Caddy, sin observabilidad permanente) apunta a ~700MB–1GB de uso real |
| Sistema operativo        | Ubuntu 26.04 (la LTS vigente; el plan original asumía 24.04, sin impacto real)                                                                                                                                                   |
| IP pública (IPv4)        | `XX.XXX.XX.XXX` — enmascarada en la documentación a propósito; el valor real vive en el secreto `VPS_HOST` de GitHub y en el gestor de contraseñas                                                                               |
| Usuario de acceso        | `ubuntu` (con `sudo`, viene así de fábrica en la imagen cloud-init — no se creó un usuario `deploy` aparte)                                                                                                                      |
| Dominio                  | `quiniweb.com`, registrado en OVHcloud                                                                                                                                                                                           |
| Subdominio de la API     | `api.quiniweb.com` → `XX.XXX.XX.XXX` (registro DNS tipo A, propagación verificada con `dig`)                                                                                                                                     |
| Repositorio de la imagen | `ghcr.io/afayaizu-dev/quini-api` (privado)                                                                                                                                                                                       |
| Login con Google         | Pospuesto a propósito — de momento solo autenticación por contraseña                                                                                                                                                             |

---

## 2. Preparación del servidor (hecho)

Acceso SSH por clave, sin contraseña:

```bash
ssh-copy-id ubuntu@XX.XXX.XX.XXX
ssh ubuntu@XX.XXX.XX.XXX 'whoami && sudo whoami'   # → ubuntu / root
```

La clave privada (`~/.ssh/id_ed25519`, con passphrase) tiene copia de seguridad guardada en el gestor de contraseñas, por si se pierde o se destruye la máquina local.

SSH bloqueado a solo clave:

```bash
ssh ubuntu@XX.XXX.XX.XXX 'sudo sed -i "s/^#\?PermitRootLogin.*/PermitRootLogin no/;s/^#\?PasswordAuthentication.*/PasswordAuthentication no/" /etc/ssh/sshd_config && sudo systemctl restart ssh'
```

Firewall (`ufw`) — solo SSH, HTTP y HTTPS entrantes:

```bash
ssh ubuntu@XX.XXX.XX.XXX 'sudo ufw default deny incoming && sudo ufw default allow outgoing && sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw --force enable && sudo ufw status verbose'
```

Actualizaciones y protección básica (`fail2ban`):

```bash
ssh ubuntu@XX.XXX.XX.XXX 'sudo apt update && sudo apt upgrade -y && sudo apt install -y ca-certificates curl gnupg fail2ban unattended-upgrades && sudo systemctl enable --now fail2ban'
```

Docker, desde el repositorio oficial:

```bash
ssh ubuntu@XX.XXX.XX.XXX 'sudo install -m 0755 -d /etc/apt/keyrings && curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo tee /etc/apt/keyrings/docker.asc > /dev/null && sudo chmod a+r /etc/apt/keyrings/docker.asc && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null && sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin && sudo usermod -aG docker ubuntu'
```

Verificado con:

```bash
ssh ubuntu@XX.XXX.XX.XXX 'docker run --rm hello-world'
```

---

## 3. Ficheros de despliegue

### `docker/docker-compose.prod.yml`

```yaml
services:
  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    mem_limit: 1200m
    memswap_limit: 1200m
    command: >
      postgres
      -c shared_buffers=512MB
      -c effective_cache_size=1536MB
      -c maintenance_work_mem=128MB
      -c work_mem=8MB
      -c max_connections=50
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
      -c checkpoint_completion_target=0.9
      -c max_wal_size=1GB
      -c wal_compression=on
      -c log_min_duration_statement=500ms
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      TZ: UTC
    volumes:
      - pgdata:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      retries: 5
    # SIN ports: solo accesible desde la red interna de Docker

  api:
    image: ghcr.io/afayaizu-dev/quini-api:${TAG:-latest}
    restart: unless-stopped
    mem_limit: 512m
    memswap_limit: 512m
    env_file: .env.prod
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ]
      interval: 30s
      timeout: 5s
      retries: 3
    # SIN ports: solo le habla Caddy

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    mem_limit: 128m
    memswap_limit: 128m
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - api

volumes:
  pgdata:
  caddy_data:
  caddy_config:
```

El volumen de Postgres usa `pgdata:/var/lib/postgresql` (no `/var/lib/postgresql/data`) para coincidir con el `docker/docker-compose.yml` de desarrollo, ya verificado en este proyecto.

### `docker/Caddyfile`

```
api.quiniweb.com {
    encode zstd gzip
    log {
        output file /data/access.log
    }

    reverse_proxy api:3000 {
        health_uri /health
    }
}
```

### `.env.prod` (vive solo en el VPS, nunca en el repo — cubierto por `.gitignore` con el patrón `.env.*`)

Plantilla, sin secretos reales:

```dotenv
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

API_BASE_URL=https://api.quiniweb.com
PUBLIC_APP_URL=https://api.quiniweb.com
CORS_ORIGINS=https://api.quiniweb.com

DB_MODE=docker
POSTGRES_USER=quini
POSTGRES_PASSWORD=<generado con: openssl rand -hex 24>
POSTGRES_DB=quini
DATABASE_URL=postgresql://quini:<el mismo valor de POSTGRES_PASSWORD>@postgres:5432/quini

JWT_ISSUER=api-quiniweb
JWT_AUDIENCE=api-quiniweb-clients
JWT_ALG=HS256
JWT_SECRET=<generado con: openssl rand -base64 32>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d

COOKIE_SECRET=<generado con: openssl rand -base64 32>
INVITATION_TTL=7d

METRICS_ENABLED=true
OTEL_ENABLED=false
ENABLE_DEV_TOKENS=false
```

Subido al VPS con:

```bash
scp .env.prod ubuntu@XX.XXX.XX.XXX:~/.env.prod
ssh ubuntu@XX.XXX.XX.XXX 'chmod 600 ~/.env.prod'
```

Puntos importantes ya decididos:

- **`JWT_ALG=HS256`, no `RS256`**: el plan original sugería `RS256` en producción, pero `src/modules/auth/tokens.ts` tiene el algoritmo fijado a `"HS256"` en el código — la variable de entorno existe en el schema pero no se usa para elegir el algoritmo. Poner `RS256` ahí no tendría efecto, así que se deja el valor que de verdad se ejecuta.
- **`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`**: omitidos a propósito (son opcionales en el schema). Se añadirán cuando se decida activar el login con Google en producción — requerirá crear credenciales OAuth de producción en Google Cloud Console con el redirect URI real.
- **`PUBLIC_APP_URL`/`CORS_ORIGINS`** apuntan al propio dominio de la API porque todavía no existe un frontend separado.
- **`ENABLE_DEV_TOKENS=false`**: crítico, nunca debe ser `true` en producción.

### `scripts/migrate.ts`

La imagen de producción no lleva `drizzle-kit` (es `devDependency`, excluida por `--omit=dev`), así que `npm run db:migrate` no sirve dentro del contenedor. Se creó este script, que usa `drizzle-orm/node-postgres/migrator` (sí es dependencia de producción) sobre los `.sql` ya generados en `drizzle/`:

```ts
import { env } from "../src/config/env.js";
import { migrateDatabase } from "../src/db/migrate.js";

migrateDatabase(env.DATABASE_URL)
  .then(() => {
    console.log("Migraciones aplicadas.");
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
```

Se ejecuta con `node dist/scripts/migrate.js` (tras `npm run build`, que ya incluye `scripts/` en `tsconfig.json`).

### `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    tags:
      - "v*"
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Login en GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build y push de la imagen
        uses: docker/build-push-action@v6
        with:
          context: .
          platforms: linux/amd64
          push: true
          tags: |
            ghcr.io/afayaizu-dev/quini-api:${{ github.sha }}
            ghcr.io/afayaizu-dev/quini-api:latest

      - name: Desplegar en el VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ubuntu
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd ~/quini-api
            export TAG=${{ github.sha }}
            docker compose --env-file .env.prod -f docker-compose.prod.yml pull api
            docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm api node dist/scripts/migrate.js
            docker compose --env-file .env.prod -f docker-compose.prod.yml up -d api
            docker image prune -f

      - name: Comprobar despliegue
        run: |
          sleep 5
          curl -fsS https://api.quiniweb.com/health
```

Se dispara con un tag `v*` o manualmente (`gh workflow run deploy.yml` / botón "Run workflow" en la pestaña Actions).

La IP del VPS vive en el secreto `VPS_HOST` de GitHub (antes iba en claro en el propio
workflow; se movió a secreto para poder documentar y compartir este repositorio sin
exponerla). `SSH_PRIVATE_KEY` es una clave **dedicada solo a CI**, generada aparte (`ssh-keygen -t ed25519 -f ~/.ssh/quini-api-deploy -N ""`, sin passphrase — no puede tener, GitHub Actions no puede teclearla), añadida como una clave autorizada más en el VPS (no sustituye a la personal) y guardada como _repository secret_ en GitHub (nunca en el repo ni en este documento).

Difiere del plan original (`docs/00-Plan-inicial.md` §15) en tres puntos, aprendidos en este mismo despliegue: migra con `node dist/scripts/migrate.js` (no `drizzle-kit`), usa `--env-file .env.prod` en cada comando de `docker compose`, y comprueba `/health` (no `/health/ready`, que no existe en el código).

---

## 4. Bugs reales encontrados al automatizar el despliegue

Como ya pasó con el `Dockerfile` (ver `docs/09-Docker.md` §4), montar el despliegue automático sacó a la luz varios problemas reales que llevaban tiempo sin detectarse:

1. **`ci.yml` llevaba 3 ejecuciones seguidas en rojo** (desde el 17 de agosto) sin que nadie se diera cuenta — se había dado por cerrado el trabajo de CI sin comprobar ejecuciones reales después. Causa: el mismo desajuste de versión de `npm` entre el lockfile local y la que trae por defecto el runner de GitHub Actions, ya resuelto en el `Dockerfile` pero nunca aplicado también aquí. Arreglo: añadir `run: npm install -g npm@12.0.2` en `ci.yml`, justo después de `actions/setup-node@v4` y antes de `npm ci`.
2. **Permisos de workflow del repositorio en modo solo lectura por defecto**: el primer intento de `deploy.yml` fallaba con `permission_denied: write_package` al hacer `docker/login-action` + `build-push-action` con `secrets.GITHUB_TOKEN`. Causa: `gh api repos/afayaizu-dev/quini-api/actions/permissions/workflow` devolvía `"default_workflow_permissions":"read"` — el bloque `permissions: packages: write` del propio workflow no basta si el techo del repositorio está en "read". Arreglo: `gh api -X PUT repos/afayaizu-dev/quini-api/actions/permissions/workflow -f default_workflow_permissions=write -F can_approve_pull_request_reviews=false` (o Settings → Actions → General → "Workflow permissions" → "Read and write permissions").
3. **El paquete GHCR no estaba vinculado al repositorio para Actions**: arreglado el punto 2, el mismo error `write_package` seguía apareciendo. Causa: el paquete `quini-api` se había creado la primera vez con un push manual desde un token personal, no desde un workflow — eso no lo vincula automáticamente al repo. Arreglo: página del paquete → "Package settings" → "Manage Actions access" → "Add Repository" → `quini-api` → Role "Write".

**Aprendido, en general**: "está commiteado" no es lo mismo que "está pasando de verdad" — conviene revisar `gh run list --workflow=<nombre>` de vez en cuando para confirmarlo, en vez de asumirlo por la existencia del fichero.

---

## 5. Backups — decisión

El VPS-1 2027 de OVHcloud **ya incluye backup diario automático de todo el disco** (retención de 24h), sin coste aparte. No sustituye del todo un backup propio de la base de datos, por tres motivos:

- Es una foto de **todo el servidor**, no solo de Postgres — restaurarla revierte todo el VPS, no "solo la tabla de pagos de ayer".
- Solo guarda **24 horas** de histórico.
- No sirve para el requisito de aceptación de F12 (**una restauración de backup probada**): probar la restauración de un snapshot de VPS es pesado; probar un `pg_restore` de un `.dump` en una base de pruebas aparte es rápido y seguro de repetir.

Decisión (dado que es un proyecto pequeño, sin necesidad de la maquinaria pesada del plan original): backup propio **ligero**, `pg_dump` semanal (no diario), guardado en el propio VPS (`~/quini-api/backups/`, con retención de 28 días) y descargado a mano al Mac (y de ahí a un disco externo) en vez de subirlo automáticamente a Drive/S3.

**`docker/backup.sh`** (vive junto a `docker-compose.prod.yml`/`Caddyfile`, copiado a `~/quini-api/` en el VPS):

```bash
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
```

`-Fc` es el formato comprimido que exige `pg_restore`; el enlace `latest.dump` evita tener que recordar la fecha al descargarlo.

**Cron** (domingos 03:15):

```bash
15 3 * * 0 cd /home/ubuntu/quini-api && ./backup.sh >> backup.log 2>&1
```

**Descarga a mano, cuando se quiera** (y de ahí al disco externo):

```bash
scp ubuntu@XX.XXX.XX.XXX:~/quini-api/backups/latest.dump ~/Downloads/quini-backup-$(date +%F).dump
```

**Restauración probada** (requisito de aceptación de F12) — contra una base de datos de pruebas aparte, sin tocar la real:

```bash
ssh ubuntu@XX.XXX.XX.XXX 'cd ~/quini-api && docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres psql -U quini -d quini -c "CREATE DATABASE quini_restore_test;"'
ssh ubuntu@XX.XXX.XX.XXX 'cd ~/quini-api && docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres pg_restore -U quini -d quini_restore_test --clean --if-exists < backups/latest.dump'
ssh ubuntu@XX.XXX.XX.XXX 'cd ~/quini-api && docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres psql -U quini -d quini_restore_test -c "SELECT count(*) FROM users;"'
```

Resultado: `count = 1` (el admin creado en el primer despliegue) — restauración confirmada correcta. Base de pruebas eliminada después con `DROP DATABASE quini_restore_test;`.

---

## 6. Login con Google en producción

Se descubrió que ni desarrollo ni producción tenían credenciales reales de Google (`.env`/`.env.test` usaban valores de mentira tipo `test-google-client-id`) — el login con Google (F6) estaba implementado y testeado con mocks, pero nunca ejercitado contra el servicio real.

Se creó un cliente OAuth **dedicado a producción**, `quini-api-prod`, separado del que ya existía para desarrollo/Insomnia (`quini-api dev`) — mismo criterio que el resto de secretos de este despliegue: nunca compartir credenciales entre entornos. Ambos clientes viven en el mismo proyecto de Google Cloud (no hace falta un proyecto separado), pero con "Authorized redirect URIs" distintas cada uno.

Consola OAuth en modo **"Testing"** (no se necesita pasar la revisión de Google para un uso de este tamaño) — solo los emails añadidos como "Test users" pueden autenticarse.

Un bug real durante la configuración: `GOOGLE_REDIRECT_URI` en `.env.prod` tenía una errata (`callbacK` con K mayúscula al final) — Google devuelve el `redirect_uri` recibido tal cual en el mensaje de error (`Error 400: redirect_uri_mismatch`), lo que lo hizo fácil de detectar mirando el detalle del error.

Verificado de extremo a extremo: login con una cuenta de Google **sin** usuario ni invitación previa → `REGISTRATION_NOT_ALLOWED` (confirma que el registro cerrado por invitación, `Q2` del plan, también aplica al flujo de Google, no solo al de contraseña); login con la cuenta de Google del admin ya existente → vinculación automática (`loginWithGoogle` en `auth.service.ts` busca por email si no hay ya una cuenta OAuth vinculada) y tokens emitidos correctamente.

`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` rellenados en `.env.prod`; de paso se limpiaron ahí también `ENABLE_DEV_TOKENS`/`OTEL_ENABLED` (ya quitadas del schema, ver deuda técnica de la sesión).
