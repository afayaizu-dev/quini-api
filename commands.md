# Comandos del la aplicación

## docker

| **comando**                                    | **Utilidad**                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| npm run db:psql -- -c '\l'                     | Sirve para entrar “indirectamente” a PostgreSQL dentro del contenedor y listar las bases de datos, sin abrir una sesión interactiva. |
| docker compose -f docker/docker-compose.yml ps | Solo inspecciona y muestra estado de la máquinas del ficheros                                                                        |

## auth / admin

| **comando**                                                          | **Utilidad**                                                                                                                         |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run admin:create -- --email=admin@quini.local --nombre="Admin"` | Bootstrap del **primer admin** (F4, Q2). Pide la contraseña por stdin (mínimo 12 caracteres). Requiere Postgres arrancado y migrado. |
| `npm run admin:create -- --email=... --nombre=... --force`           | Igual que arriba, pero permite crear otro admin aunque ya exista uno. Sin `--force`, el script se niega si `hasAdmin()` es `true`.   |

**Notas**:

- El script vive en `scripts/create-admin.ts` y usa `createUser` (`src/modules/auth/auth.repository.ts`) con `role: "admin"`.
- La contraseña se hashea con Argon2id (`src/modules/auth/password.ts`) antes de guardarse; nunca se guarda en claro.
- Al terminar, cierra el pool de conexiones (`pool.end()` en el `.finally`), así que el proceso no se queda colgado.

| **comando**                                               | **Utilidad**                                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run token -- --email=admin@quini.local --role=admin` | Minta un access token JWT de desarrollo para un usuario **ya existente**, sin pasar por login/contraseña. Útil para probar Insomnia/curl a mano. |

**Notas**:

- El script vive en `scripts/mint-token.ts`. Busca el usuario por email con `findUserByEmail` y firma el token con `signAccessToken` (`src/modules/auth/tokens.ts`).
- `--role` es opcional: si se omite, usa el rol real del usuario en BD; si se indica, **sobreescribe** el rol solo en el JWT (no toca la BD) — sirve para probar `requireRole('admin')` sin crear un segundo usuario.
- Se niega a ejecutar si `NODE_ENV=production`.
- Si el email no existe en BD, falla — hay que crear el usuario antes (`admin:create` o, más adelante, invitación + registro).

| **comando**                                                                        | **Utilidad**                                                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `export TOKEN=$(npm run token --silent -- --email=admin@quini.local --role=admin)` | Guarda el access token minteado en la variable `TOKEN` de la sesión de terminal, para usarlo en `curl`. |

**Notas**:

- `--silent` evita que npm mezcle sus propios logs con la salida del script, para que `$()` capture solo el JWT.
- `TOKEN` vive únicamente en esa sesión de shell: no se persiste en ningún fichero ni se commitea. Se usa así:
  ```bash
  curl -s http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer $TOKEN" | jq
  ```
- Es un access token de corta duración (`ACCESS_TOKEN_TTL` en `.env`): si caduca, vuelve a exportarlo.
- No pasa por la tabla `refresh_tokens` ni por login real: solo sirve para pruebas rápidas de rutas protegidas y de `requireRole`.
