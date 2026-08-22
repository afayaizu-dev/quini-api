# 11 — Carga de datos reales

> Documento de aprendizaje y de seguimiento a la vez: explica **por qué** el proceso de carga se diseñó así, y se actualiza a medida que se completa cada tabla. No es una especificación cerrada — algunos detalles de los ficheros CSV pueden ajustarse al revisar los datos reales, tabla a tabla.

## Contexto

Hasta ahora la peña se ha gestionado en una hoja de cálculo. El objetivo de esta fase **no es operar la peña a través de la API** (eso vendrá con el frontend) — es **construir una base de datos real y fiel** con el histórico ya jugado, para que la app esté "viva" con datos de verdad en cuanto haya interfaz.

Se pospuso F13 (observabilidad) a propósito para priorizar esto: instrumentar un servicio sin tráfico real aporta poco; tendrá mucho más sentido cuando haya un frontend y uso genuino que observar.

Todos los datos a cargar son **históricos**: jornadas ya disputadas, con sus apuestas y resultados oficiales ya conocidos. Esto tiene una implicación importante que se explica en el siguiente apartado.

La carga debe ser **idempotente**: volver a pasar el mismo fichero (por ejemplo, tras corregir un dato) debe **actualizar**, nunca fallar por duplicado. Los ficheros usan claves naturales y legibles — número de jornada, apodo del miembro, código de temporada — nunca `uuid`; esos los genera la base de datos sola (`uuidv7()`).

---

## 1. Por qué NO se carga vía API (y sí escribiendo directo a través de los repositorios)

La primera idea, razonable a priori, era automatizar llamadas a los endpoints ya existentes (los mismos que usa Insomnia). Al investigar los _services_ uno a uno, aparecieron **cuatro bloqueos reales** que lo hacen impracticable para datos históricos:

| Bloqueo                                                                                             | Dónde vive                                       | Por qué rompe la carga histórica                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `creadaPor` se fija siempre al usuario del token que hace la llamada                                | `apuestas.service.ts` (`create`)                 | Si un admin carga las apuestas de todos los miembros, **todas** quedarían marcadas como "creadas por el admin" — falseando para siempre el KPI `porcentajeApuestasPropias` que ya expone el dashboard (F21). No hay forma de corregirlo después vía API.                                                                                                 |
| `PUT /jornadas/:n` (reemplazo completo) se **rechaza** si la jornada ya tiene apuestas o resultados | `jornadas.service.ts` (`replace`)                | Si detectas un error en un partido después de haber cargado sus apuestas, ya no puedes corregirlo por API. Choca de frente con el requisito de idempotencia ("puedo repetir la carga si me equivoco").                                                                                                                                                   |
| `POST /calculos` exige que la temporada esté **activa**, y solo puede haber una activa a la vez     | `calculos.service.ts` (`ejecutar`)               | Cargar varias temporadas históricas obligaría a ir activando y desactivando cada una por turnos — moviendo el estado global de la aplicación en producción solo para poder escribir datos viejos.                                                                                                                                                        |
| Las apuestas solo se aceptan si la "ventana" de apuestas está abierta en este instante              | `apuestas.service.ts` (`assertApuestasAbiertas`) | Una jornada ya jugada nunca tiene su ventana real abierta _ahora_. Habría que fingir una ventana artificial (abrir → cargar → restaurar) en cada jornada — 3 llamadas extra solo para maquillar fechas, y con el riesgo de que esa jornada aparezca momentáneamente "abierta para apostar" de cara a cualquiera que esté mirando la app en ese instante. |

Estos bloqueos no son bugs — son exactamente las reglas de negocio correctas para **operar la peña en vivo** (que nadie manipule apuestas ajenas, que no se reescriba una jornada ya jugada, que solo haya una temporada "actual"). El problema es que una carga histórica no es "operar en vivo", es poblar la base de datos con hechos ya consumados, y forzar esas reglas para ese caso de uso añade complejidad y riesgo sin aportar ninguna seguridad real.

**La decisión: el proceso de carga llama directamente a los _repositorios_ de cada módulo**, saltándose la capa de _service_ (que es donde viven esas guardas). Esto es importante que quede claro: **no es un atajo que duplique lógica**. El SQL de cada tabla sigue viviendo en un único sitio — el repositorio correspondiente (`equipos.repository.ts`, `apuestas.repository.ts`, etc.) — que es exactamente el mismo que usa la API en producción. Lo único que se omite son las comprobaciones de negocio de los _services_, que tienen sentido para proteger la operación en vivo y ninguno para poblar histórico.

Este patrón no es nuevo en el proyecto: `scripts/create-admin.ts` ya hace esto mismo — llama a `createUser` (repositorio), no pasa por el flujo de invitación + registro del _service_ de auth.

```mermaid
flowchart LR
    subgraph vivo["Operación en vivo (API)"]
        C[Cliente HTTP] --> R[routes] --> CT[controller] --> S[service<br/>reglas de negocio] --> REPO1[repository]
    end
    subgraph carga["Carga histórica (este proceso)"]
        CSV[CSV] --> SC[scripts/carga/*.ts] --> REPO2[repository]
    end
    REPO1 --> DB[(Postgres)]
    REPO2 --> DB

    style S fill:#efe,stroke:#3a3
    style SC fill:#eef,stroke:#33f
```

Ambos caminos convergen en el mismo repositorio — la única fuente de verdad del SQL no cambia, solo cambia quién decide si la escritura es válida.

---

## 2. Destino configurable: local o producción, con la misma variable de siempre

No hace falta ninguna variable nueva — el destino ya lo decide `DATABASE_URL`, exactamente igual que en `scripts/migrate.ts` o `scripts/create-admin.ts`:

- **En local**: `npm run carga` con `--env-file=.env`, apuntando a tu Postgres de desarrollo.
- **En producción**: el script se ejecuta **dentro del contenedor** de la API en el VPS (`docker compose exec api ...`), donde `.env.prod` ya provee la `DATABASE_URL` real. No hace falta tocar la topología de red — el Postgres de producción sigue sin publicar el puerto 5432 al exterior, tal como se documentó en `docs/10-Configuracion-Despliegue-VPS.md`.

Para producción, los ficheros de `seed/` se copian al VPS con `scp` (sin rebuild ni redeploy) y el servicio `api` de `docker-compose.prod.yml` monta esa carpeta de solo lectura.

---

## 3. Formato de los ficheros: `seed/*.csv`

CSV con cabecera, separador **`;`** — es el que usa Excel en español por defecto, y así el separador decimal `,` no colisiona con el delimitador de columnas. Los campos numéricos aceptan tanto `,` como `.` como decimal. Una columna vacía se interpreta como `null`.

| Fichero          | Columnas reales                                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `equipos.csv`    | `nombreLargo;nombreCorto`                                                                                                                                                                   |
| `temporadas.csv` | `codigo;nombre;fechaInicio;fechaFin;activa`                                                                                                                                                 |
| `usuarios.csv`   | `email;role;nombre;apellidos;apodo` (`telefono` es opcional, se puede añadir si hace falta)                                                                                                 |
| `jornadas.csv`   | `temporada;numeroJornada;fecha;creadoPor;fechaAperturaApuestas;fechaCierreApuestas;fechaCierreJornada;apuestaPleno15`                                                                       |
| `partidos.csv`   | `jornada;orden;equipoLocal;equipoVisitante` (15 filas por jornada — **sin** columna `temporada`, ver §6.2)                                                                                  |
| `apuestas.csv`   | `jornada;apodo;numeroApuesta;p1;…;p14;creadaPorApodo` (**sin** columna `temporada`, ver §6.2; `sugerenciaPleno15` es opcional, no se usa todavía)                                           |
| `resultados.csv` | `jornada;r1;…;r14;resultado15;premio10;…;premio15` (**sin** columna `temporada`, ver §6.2)                                                                                                  |
| `pagos.csv`      | `apodo;importe;fecha;registradoPorApodo` (ver §6.1 — de momento vacío, solo cabecera, hasta que haya pagos reales que registrar)                                                            |
| `calculos.csv`   | _(opcional, solo para contrastar — todavía no usado)_ `apodo;aciertosApuesta1;aciertosApuesta2;aciertosMax;premioApuesta1;premioApuesta2;ranking;escalon;importeEscalon;costeApuestas;bote` |

Nota sobre la evolución del diseño: la primera versión de este documento incluía `temporada`/`numeroJornada` en todos los ficheros que cuelgan de una jornada. Al escribir el código real se simplificó a solo `jornada` (número), apoyándose en la decisión de §6.2 (una sola temporada activa por carga) — la tabla de arriba refleja el formato **real** que usan los CSV cargados, no el borrador inicial. También se descubrió que `creadoPor`/`creadaPorApodo` son necesarios en `jornadas.csv`/`apuestas.csv` (el modelo exige un autor, `NOT NULL`), algo que el primer borrador de este documento no había anticipado.

Detalles de formato que impone el modelo de datos real (no son arbitrarios — son los mismos `CHECK` de Postgres y schemas Zod que ya valida la API):

- **`codigo` de temporada**: formato `AAAA-AA` (ej. `2026-27`), y `fechaFin` debe ser posterior a `fechaInicio`.
- **`activa`**: a lo sumo **una** fila de `temporadas.csv` puede traer `true` — hay un índice único parcial en la base de datos que lo impone.
- **`rol`**: `user` o `admin`. La contraseña **no va en el CSV** — sale de la variable de entorno `CARGA_PASSWORD`, la misma para todos los usuarios de carga (son cuentas `@example.com`, no hace falta una distinta por persona).
- **`apodo`** es la clave que usan `apuestas.csv` y `calculos.csv` para identificar al miembro — pero el _upsert_ de usuarios en sí se hace por `email` (es el único campo `NOT NULL` con restricción única; `apodo` es opcional en la base de datos).
- **`creadaPorApodo`** (opcional en `apuestas.csv`): si se deja vacío, la apuesta se marca como creada por su propio dueño. Si se rellena con el apodo de otro miembro (por ejemplo, si alguien apostó en nombre de otro), queda reflejado con fidelidad — es justo el dato que la API no permite fijar correctamente si se carga vía HTTP.
- **Signos de apuestas/resultados**: `1`, `X` o `2`, siempre en **mayúscula**. El pleno al 15 (`resultado15`, `apuestaPleno15`, `sugerenciaPleno15`) tiene un formato distinto: `^[012M]-[012M]$` (dos valores separados por un guion; `M` significa "más de 2 goles").
- **Fechas**: `fecha` de la jornada es una fecha simple (`YYYY-MM-DD`); las tres fechas de ventana (`fechaAperturaApuestas`, `fechaCierreApuestas`, `fechaCierreJornada`) son marcas de tiempo completas (ISO).

**Nota real, encontrada al cargar `equipos.csv`**: los CSV exportados desde Excel llevan un **BOM UTF-8** (3 bytes `EF BB BF`) al principio del fichero, que corrompe el nombre de la primera columna de la cabecera (`fila.nombreLargo` sale `undefined` en todas las filas). `leerCsv()` en `scripts/carga/csv.ts` ya lo recorta automáticamente si está presente — no hace falta limpiar los CSV a mano por esto.

---

## 4. Estructura del proceso

```
seed/                       ← los CSV, versionados en git (no hay datos personales reales: emails @example.com)
scripts/carga/
  csv.ts        ← parser mínimo (separador ';', decimal ',' o '.') y helpers de conversión de tipos
  contexto.ts   ← mapas de clave natural → uuid: nombreLargo→equipo, email/apodo→usuario,
                  código→temporada, "código#número"→jornada
  equipos.ts · temporadas.ts · usuarios.ts · jornadas.ts · apuestas.ts · resultados.ts · pagos.ts · calculos.ts
  index.ts      ← orquestador: decide el orden, construye el contexto, agrega el resumen final
```

Cada módulo de carga expone una función `cargar(ctx)` y devuelve un resumen `{ creados, actualizados, errores }`.

**Se valida todo antes de escribir nada.** Cada tabla se procesa en dos fases:

1. **Validación completa**: se parsean _todas_ las filas del CSV, comprobando tanto el formato (con los mismos schemas Zod que usa la API — `CreateApuestaSchema`, `UpsertResultadosSchema`, etc.) como la integridad referencial (¿existe el equipo que menciona esta fila? ¿existe la jornada?) contra los mapas de `contexto.ts`. Cualquier error se acumula con su número de línea, sin detener el proceso.
2. **Escritura**, solo si la fase 1 no encontró ningún error.

Con una hoja de cálculo como origen de los datos, este orden importa mucho: es mucho más útil saber de golpe "hay 3 filas mal en `apuestas.csv`, líneas 12, 40 y 87" que descubrir el error de la fila 40 después de haber escrito ya las 39 anteriores.

**Ejecución**: el orquestador es código TypeScript, no un script `.sh` generado a partir de los CSV — así puede manejar de verdad el orden de dependencias entre tablas, los mapas clave→uuid, y la agregación de errores.

```bash
npm run carga                      # todo, en el orden correcto
npm run carga -- --solo=equipos    # una sola tabla, para iterar rápido
npm run carga -- --dry-run         # solo valida, no escribe nada
npm run carga -- --calcular        # además deriva resultados_miembro (ver §7)
```

**Nota real, encontrada al cargar `jornadas`**: los mapas de `contexto.ts` (`temporadasPorCodigo`, `equiposPorNombre`, `usuariosPorApodo`...) solo se rellenan cuando su módulo corre **en el mismo proceso**. Con `--solo=jornadas`, si `equipos`/`temporadas`/`usuarios` se cargaron en ejecuciones anteriores y separadas, el contexto en memoria de esta ejecución nace vacío — aunque los datos sí existen en la base de datos. Por eso `contexto.ts` incluye funciones `resolverTemporada`/`resolverEquipo`/`resolverUsuarioPorApodo`: si la clave no está en memoria, consultan la base de datos y la cachean. Así `--solo=X` funciona de verdad de forma aislada.

---

## 5. Qué se reutiliza (nada de SQL nuevo)

| Ya existe                                                              | Dónde                          | Cómo se usa en la carga                                                                                                                                                |
| ---------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `create` / `findByNombreLargo` / `update`                              | `equipos.repository.ts`        | upsert de equipos por `nombreLargo` (columna `citext`, comparación insensible a mayúsculas)                                                                            |
| `create` / `findByCodigo` / `update` / `activate`                      | `temporadas.repository.ts`     | upsert de temporadas por `codigo`                                                                                                                                      |
| `createUser`                                                           | `auth.repository.ts`           | alta de usuario **sin** pasar por el flujo de invitación + registro                                                                                                    |
| `findUserByEmail`                                                      | `auth.repository.ts`           | detectar si el usuario ya existe (decide crear vs. actualizar)                                                                                                         |
| `updatePerfil`                                                         | `usuarios.repository.ts`       | rellenar `apellidos` / `apodo` / `telefono` tras la creación                                                                                                           |
| `hash`                                                                 | `src/modules/auth/password.js` | generar el hash de `CARGA_PASSWORD`                                                                                                                                    |
| `create` / `findByNumero` / `replace` / `updateFechas` / `updatePleno` | `jornadas.repository.ts`       | jornada + sus 15 partidos (se insertan juntos en una transacción), y las fechas reales de ventana                                                                      |
| `create` / `findOne` / `replace`                                       | `apuestas.repository.ts`       | upsert por `(jornadaId, usuarioId, numeroApuesta)` — y crucialmente, `create` acepta `creadaPor` como parámetro explícito, así que la autoría queda fiel a la realidad |
| `upsert`                                                               | `resultados.repository.ts`     | ya es un `ON CONFLICT DO UPDATE` sobre `jornadaId` — idempotente de fábrica, sin tocar nada                                                                            |
| `calcularJornada`                                                      | `calculos.algoritmo.ts`        | es una **función pura** (sin efectos secundarios) — se reutiliza literalmente igual que la usa la API                                                                  |
| `findEscalones` / `upsertResultadosMiembro`                            | `calculos.repository.ts`       | leer la tabla de escalones de pago (ya sembrada por migración) y guardar las liquidaciones (también upsert)                                                            |
| `create` / `findByUsuario`                                             | `pagos.repository.ts`          | alta de pago; `findByUsuario` se usa para la comprobación manual de idempotencia (ver §6.1, `pagos` no tiene upsert nativo)                                            |
| Los schemas Zod de cada módulo (`*.schemas.ts`)                        | cada módulo                    | validar cada fila del CSV con exactamente las mismas reglas que ya aplica la API                                                                                       |

El único cambio necesario en `src/` es **exportar** dos funciones hoy privadas de `calculos.service.ts` (`toApuestaCalculo`, `toResultadoCalculo`) — el mismo tipo de movimiento que ya se hizo en F21 con `resolveUsuarioObjetivo` (extraerla de `apuestas.service.ts` a `usuarios.service.ts` para que el dashboard pudiera reutilizarla). Al estar ya cubiertas por los tests existentes de `calculos.service.ts`, exportarlas no cambia la cobertura.

---

## 6. Orden de carga y por qué

```mermaid
flowchart TD
    A[equipos] --> D[jornadas + partidos]
    B[temporadas] --> D
    C[usuarios] --> E[apuestas]
    D --> E
    D --> F[resultados]
    E --> G[cálculos]
    F --> G
```

- **`equipos`** antes que nada: los partidos de cada jornada se identifican por nombre de equipo, no por uuid.
- **`temporadas`** antes que `jornadas`: cada jornada pertenece a una temporada (por código).
- **`usuarios`** antes que `apuestas`: cada apuesta pertenece a un usuario (por apodo) y tiene un autor (por apodo).
- **`jornadas`+`partidos`** antes que `apuestas` y `resultados`: ambas cuelgan de una jornada concreta.
- **`cálculos`** al final: necesita tanto las apuestas como los resultados oficiales ya cargados.

### 6.1 `pagos.csv` y el crédito inicial

El `credito` de un usuario (`pagosService.getCredito`, docs/08 §3.3) se calcula al vuelo, no es un campo cargable directamente. Se añadió un módulo `scripts/carga/pagos.ts` (`seed/pagos.csv`, columnas `apodo;importe;fecha;registradoPorApodo`) que usa `pagosRepository.create`.

**`pagos` no tiene ninguna clave natural única** (la tabla no tiene `UNIQUE` más allá del `id`), así que no puede hacer un _upsert_ como el resto de módulos. La idempotencia se resuelve a mano: antes de insertar, se comprueba con `findByUsuario` si ya existe un pago del mismo usuario con el mismo `importe` y la misma `fecha` — si coincide, se cuenta como "ya existía" y no se duplica. **Limitación conocida**: dos pagos reales distintos, del mismo importe y el mismo día, colisionarían con esta comprobación (se tratarían como el mismo). Aceptable para una carga inicial controlada; no serviría como mecanismo general de idempotencia si el volumen de pagos creciera mucho.

**Importante**: el importe de un pago debe ser siempre `> 0` (`CHECK` en la base de datos y en el schema `CreatePagoSchema`) — un "pago" es siempre una aportación positiva, nunca una forma de representar deuda.

### 6.1.1 Deuda arrastrada de antes de la app: columna `saldoInicial`

Al cargar los pagos reales apareció un caso genuino no contemplado por el modelo: varios miembros arrastran una deuda **anterior** a esta aplicación (de la gestión manual previa en hoja de cálculo) — no una deuda derivada de jornadas ya calculadas aquí. Como un `pago` no puede ser negativo (arriba), no hay forma de representar esto con una fila de `pagos`.

Se añadió una columna nueva, `saldo_inicial` (`numeric(12,2) NOT NULL DEFAULT 0`) a `users` (migración `drizzle/0007_odd_colonel_america.sql`), y se incorporó a la fórmula del crédito en `pagosRepository.getCredito`:

```sql
credito = SUM(pagos.importe) − SUM(resultados_miembro.importe_escalon) + saldo_inicial
```

Es un ajuste de una sola vez, **no forma parte del proceso de carga recurrente** — no hay ningún CSV ni módulo para él; se fija a mano por `apodo` cuando se revisa la hoja de cálculo real:

```bash
psql postgresql://quini:quini@localhost:5432/quini -c "UPDATE users SET saldo_inicial = -15.00 WHERE apodo = 'A';"
```

No se expone (todavía) por ningún endpoint de la API — solo se toca vía base de datos. Si en el futuro hiciera falta que un admin lo ajuste desde la aplicación, sería un endpoint/campo nuevo y deliberado, no una extensión de `UpdatePerfilSchema` (ese schema también lo usa `PUT /usuarios/me`, y dejar que un usuario ajuste su propio saldo inicial sería un fallo de seguridad real).

### 6.2 Decisión: `partidos.csv` sin columna `temporada`, asume una sola temporada por carga

`partidos.csv` identifica cada partido solo por `jornada` (número) + `orden`, sin columna `temporada`. Decisión consciente: **de momento solo se carga la temporada activa**, así que no hay ambigüedad. Si en el futuro se carga el histórico de varias temporadas a la vez (por ejemplo, jornada 1 de `2025-26` y jornada 1 de `2026-27` en el mismo fichero), esto dejaría de ser seguro — habría que añadir la columna `temporada` a `partidos.csv` en ese momento, no antes.

---

## Estado de la carga

Esta sección se actualiza según se completa cada paso.

- [x] Paso 1 — Andamiaje (`seed/`, `scripts/carga/csv.ts`, `contexto.ts`, `index.ts`, entrada en `package.json`)
- [x] Paso 2 — `equipos` (28 equipos cargados, idempotencia verificada)
- [x] Paso 3 — `temporadas` (temporada `2026-27` cargada y activada)
- [x] Paso 4 — `usuarios` (9 miembros de prueba + 1 admin real actualizado, idempotencia verificada)
- [x] Paso 5 — `jornadas` + `partidos` (jornada 1, temporada `2026-27`, 15 partidos, idempotencia verificada)
- [x] Paso 6 — `apuestas` (8 apuestas cargadas para 4 miembros, signos normalizados a mayúscula, idempotencia verificada)
- [x] Paso 7 — `resultados` (jornada 1 cargada, upsert nativo, idempotencia verificada)
- [x] Paso 8 — `calculos` (jornada 1 liquidada para 4 miembros, sin contraste — hoja de este año aún no preparada, idempotencia verificada)
- [x] Paso 8.1 — `pagos` (10 pagos simbólicos de prueba, idempotencia por usuario+importe+fecha verificada) + columna `saldoInicial` en `users` para deuda arrastrada de antes de la app (ver §6.1/§6.1.1)
- [x] Paso 9 — Ejecución en producción (VPS: volumen `seed/` montado, carga completa + `--calcular` verificados, `saldoInicial` real de los 10 miembros aplicado, `pagos` de prueba vaciados)

## 7. Contraste del algoritmo contra datos reales

Si `seed/calculos.csv` existe, el paso 8 no solo deriva `resultados_miembro` con `calcularJornada` — también compara el resultado contra esas cifras (las de tu hoja de cálculo actual) y reporta cualquier diferencia por miembro. Es, de hecho, la **primera vez que el algoritmo de liquidación (F19/F20) se valida contra datos reales** — hasta ahora solo se ha probado con casos sintéticos en los tests.

Dos discrepancias son esperables y no indican un bug si aparecen:

- **Los escalones de pago sembrados** por la migración `drizzle/0005_deep_madame_masque.sql` (escalón 1 → 1,50€ … escalón 10 → 2,50€) pueden no coincidir exactamente con los que usa tu hoja.
- **El coste por apuesta está fijado a 1,50€** en el código (`COSTE_APUESTAS` en `calculos.algoritmo.ts`), con independencia de si un miembro juega una o dos apuestas esa jornada.

Si aparece cualquier otra discrepancia, sí merece investigarse — sería un caso real que los tests sintéticos no cubrieron.

## 8. Riesgos conocidos, asumidos a propósito

- **`createdAt` no es inyectable**: los usuarios y apuestas cargados quedarán con la fecha de hoy como fecha de alta, no la histórica real. Asumido — el dashboard no usa ese campo para nada.
- **`upsertResultadosMiembro` no borra filas huérfanas**: si se recalcula una jornada tras haber quitado una apuesta, la fila antigua de ese miembro en `resultados_miembro` persiste y contaminaría el bote total. Si llega a pasar, se borra esa fila a mano.
- **Sin transacción global envolvente**: cada repositorio abre las suyas propias (por ejemplo, `jornadasRepository.create` inserta jornada+partidos en una transacción, pero no hay una transacción que envuelva la carga completa de un CSV entero). La seguridad real viene de validar todo antes de escribir nada, y de que cada operación de escritura es en sí misma idempotente.

---

## 9. Ejecución en producción

El servicio `api` de `docker/docker-compose.prod.yml` monta `seed/` como volumen de **solo lectura**:

```yaml
api:
  image: ghcr.io/afayaizu-dev/quini-api:${TAG:-latest}
  env_file: .env.prod
  volumes:
    - ./seed:/app/seed:ro
```

Sin rebuild ni redeploy de la imagen para cada CSV nuevo — la imagen es código, `seed/` son datos (ver `docs/09-Docker.md` para la discusión completa de por qué se separan). Los pasos, la primera vez o cuando cambie el propio `docker-compose.prod.yml`:

1. Subir el compose actualizado y recrear con `pull` (ver §10.4 — el porqué del `pull` explícito es importante).
2. Copiar `seed/` al VPS con `scp -r`.
3. Confirmar que `CARGA_PASSWORD` está en `.env.prod` del VPS (necesaria para `usuarios`, mínimo 12 caracteres).
4. Ejecutar la carga dentro del contenedor ya en marcha (§10.1).

### Dos bugs reales encontrados en el primer despliegue de este proceso

**1. Recrear el contenedor a mano sin especificar la imagen puede dejarlo con una versión vieja.** `deploy.yml` despliega usando una etiqueta por **SHA de commit** (`TAG=${{ github.sha }}`), no `:latest`. Si después, a mano, recreas el contenedor sin indicar `TAG` (por ejemplo para que recoja un cambio en `docker-compose.prod.yml`, como el volumen de `seed/`), Docker Compose usa por defecto `:latest` — y si esa etiqueta no se ha vuelto a descargar en esa sesión, **reutiliza la imagen que ya tuviera cacheada localmente**, que puede ser de un despliegue anterior. El síntoma fue confuso: el contenedor arrancaba bien, pero `dist/scripts/carga/` no existía dentro — resultó ser la imagen del día anterior. Arreglo: antes de cualquier `--force-recreate` manual, hacer `pull` explícito:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml pull api
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --force-recreate api
```

**2. Los contenedores leen `env_file` solo al crearse, nunca en caliente.** Añadir una variable nueva a `.env.prod` (como `CARGA_PASSWORD`) no la hace visible al contenedor que ya está corriendo — hace falta recrearlo explícitamente **después** de guardar el fichero. Si el orden se descuadra (recrear antes de terminar de editar, o editar después de recrear), el contenedor se queda con la variable ausente sin ningún error visible aparente — la carga simplemente falla con "Falta CARGA_PASSWORD en el entorno", que parece un problema del script cuando en realidad es de sincronización de pasos. La forma fiable de comprobarlo, sin asumir nada:

```bash
docker exec quini-api-api-1 printenv | grep CARGA
```

Si no aparece, el contenedor no se recreó de verdad después de editar el fichero — hay que repetir el `up -d --force-recreate` y volver a comprobar.

---

## 10. Guía operativa: cargar, borrar y actualizar

### 10.1 Cargar

|                      | Local                             | VPS (producción)                                                                                                                                        |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Todo                 | `npm run carga`                   | `ssh ubuntu@XX.XXX.XX.XXX 'cd ~/quini-api && docker compose --env-file .env.prod -f docker-compose.prod.yml exec api node dist/scripts/carga/index.js'` |
| Solo una tabla       | `npm run carga -- --solo=equipos` | añade `-- --solo=equipos` al final del `node dist/scripts/carga/index.js` de arriba                                                                     |
| Validar sin escribir | `npm run carga -- --dry-run`      | añade `-- --dry-run`                                                                                                                                    |
| Incluir cálculos     | `npm run carga -- --calcular`     | añade `-- --calcular`                                                                                                                                   |

En producción, el destino real (`DATABASE_URL`) lo decide `.env.prod`, ya cargado dentro del contenedor — no hay que indicar nada aparte.

### 10.2 Actualizar un dato ya cargado

Dos casos distintos, según si el dato vive en un CSV o no:

- **Si el dato viene de un CSV** (un equipo, una jornada, una apuesta...): edita la fila en `seed/*.csv` y repite la carga (§10.1) — todos los módulos son _upsert_, así que corregir y recargar actualiza en vez de duplicar. En producción, primero hay que llevar el CSV actualizado al VPS:
  ```bash
  scp seed/equipos.csv ubuntu@XX.XXX.XX.XXX:~/quini-api/seed/
  ```
  y luego ejecutar la carga (con `--solo=` si solo cambió una tabla).
- **Si el dato NO viene de un CSV** (por ejemplo `saldoInicial`, ver §6.1.1): es un `UPDATE` directo, sin pasar por `scripts/carga/`:
  ```bash
  # local
  psql postgresql://quini:quini@localhost:5432/quini -c "UPDATE users SET saldo_inicial = 9.00 WHERE apodo = 'A';"

  # VPS
  ssh ubuntu@XX.XXX.XX.XXX 'cd ~/quini-api && docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres psql -U quini -d quini -c "UPDATE users SET saldo_inicial = 9.00 WHERE apodo = '\''A'\'';"'
  ```
  Para varios `UPDATE` a la vez, es más cómodo mandar un fichero `.sql` por `stdin` en vez de anidar comillas (así se hizo con `resorces/sql/01-saldos-iniciales.sql`, ver §6.1.1):
  ```bash
  ssh ubuntu@XX.XXX.XX.XXX 'cd ~/quini-api && docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres psql -U quini -d quini' < resorces/sql/01-saldos-iniciales.sql
  ```

### 10.3 Borrar (vaciar una tabla)

Solo hace falta para `pagos` (sin _upsert_, ver §6.1) o para limpiar datos de prueba. `TRUNCATE` es preferible a `DELETE` (más rápido, reinicia cualquier secuencia):

```bash
# local
psql postgresql://quini:quini@localhost:5432/quini -c "TRUNCATE TABLE pagos;"

# VPS
ssh ubuntu@XX.XXX.XX.XXX 'cd ~/quini-api && docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres psql -U quini -d quini -c "TRUNCATE TABLE pagos;"'
```

Si la tabla tiene claves foráneas que dependen de ella (por ejemplo, borrar un usuario que ya tiene invitaciones), Postgres lo rechaza con un error explícito nombrando la restricción — nunca falla en silencio. Hay que borrar primero la tabla dependiente, o usar `TRUNCATE ... CASCADE` si de verdad se quiere arrastrar todo lo que cuelgue.

**Importante**: después de un `TRUNCATE` de `pagos` en producción, si se vuelve a ejecutar `npm run carga` completo y `seed/pagos.csv` todavía tiene filas, el módulo `pagos` las recreará (es idempotente, no sabe que las borraste tú a mano). Si el objetivo es que una tabla quede vacía de forma duradera, hay que vaciar también el CSV correspondiente (dejar solo la cabecera), no solo la base de datos — es justo lo que se hizo con `pagos.csv` tras decidir usar `saldoInicial` en su lugar (§6.1.1).

### 10.4 Recrear el contenedor de producción tras un cambio de configuración

Necesario cuando cambia `docker-compose.prod.yml` o `.env.prod` (nunca cuando solo cambia un CSV — eso no requiere tocar el contenedor en absoluto, ver §10.1/§10.2):

```bash
scp docker/docker-compose.prod.yml ubuntu@XX.XXX.XX.XXX:~/quini-api/      # si cambió el compose
ssh ubuntu@XX.XXX.XX.XXX 'cd ~/quini-api && docker compose --env-file .env.prod -f docker-compose.prod.yml pull api && docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --force-recreate api'
```

El `pull` antes del `--force-recreate` no es opcional — ver §9 para el bug real que costó diagnosticar por saltárselo.
