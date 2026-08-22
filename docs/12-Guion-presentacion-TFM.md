# Guion de presentación — TFM `quini-api`

> **Estado:** borrador inicial. Este guion propone el relato, el orden de las diapositivas y los mensajes a defender. Los elementos marcados como **[Completar por el autor]** requieren información personal o decisiones que aún no forman parte del repositorio.

## 1. Propósito de la presentación

Presentar `quini-api` como la primera pieza de una solución de gestión de una peña de quiniela: una API REST segura, documentada, probada y desplegada. La exposición no debe ser una enumeración de tecnologías; debe explicar **qué problema se resuelve, qué decisiones se tomaron, cómo se comprobó el resultado y cómo el trabajo aplica los contenidos del Máster en Desarrollo con IA**.

### Mensaje central

> He construido y validado una API de backend con prácticas de ingeniería de software actuales, utilizando la IA como apoyo para razonar, documentar, implementar y verificar, pero conservando el control humano de cada decisión y ejecución.

### Duración orientativa

15–18 minutos de exposición + preguntas. Si el tiempo disponible fuera menor, pueden fusionarse las diapositivas 10–11 y 13–14.

## 2. Estructura propuesta

| Bloque              | Diapositivas | Tiempo | Objetivo                                                     |
| ------------------- | -----------: | -----: | ------------------------------------------------------------ |
| Apertura            |          1–3 |  2 min | Presentarme y situar el problema.                            |
| Construcción        |         4–12 |  9 min | Explicar metodología, arquitectura, datos y funcionalidades. |
| Calidad y operación |        13–16 |  4 min | Defender seguridad, pruebas y despliegue.                    |
| Cierre              |        17–18 |  2 min | Mostrar continuidad y sintetizar el aprendizaje.             |

---

## 3. Guion diapositiva a diapositiva

### 1. Portada

**En pantalla**

- `quini-api`: backend para la gestión de una peña de quiniela.
- Trabajo Final de Máster en Desarrollo con IA.
- **[Nombre y apellidos]**, **[fecha]**.

**Qué explicar**

Una frase de apertura: «Presento la API que constituye el núcleo de una aplicación de gestión de una peña de quiniela; el proyecto se ha desarrollado con una metodología de trabajo asistida por IA y validada paso a paso.»

**Ámbitos del Máster**: Proyecto final; desarrollo potenciado por IA.

---

### 2. Presentación personal

**En pantalla — completar por el autor**

- Javier Fernández — Ingeniero Superior Informático por la Universidad de Oviedo.
- Trayectoria completa en Asturias: desarrollador, analista, jefe de proyecto y adjunto a dirección de departamento.
- 22 años en giConsultoría; actualmente **Responsable de Consultoría**: asesoramiento tecnológico, propuestas a cliente y transformación digital.
- Equipos dirigidos de 2 a 45 personas. Clientes como Arcelor, TotalEnergies, El Corte Inglés o el Gobierno del Principado.
- Motivación: la profesión exige actualizarse, y más con la IA redefiniendo perfiles y procesos. Y una razón personal: desarrollar sigue siendo una afición.

**Qué explicar**

Conectar la experiencia previa con el objetivo del máster, que es doble: **actualizar criterio técnico** sobre cómo la IA redefine el trabajo de desarrollo, y **poder analizar su efecto en procesos, plazos y costes** — lo segundo es directamente aplicable al puesto actual. El proyecto es el banco de pruebas de las dos cosas.

**Ámbitos del Máster**: Mentalidad y metodología de estudio; IA en el proceso de desarrollo.

---

### 3. Contexto y alcance del proyecto

**En pantalla**

```text
Hoy: API REST (quini-api)
       ↓
Siguiente fase: frontend web
       ↓
Evolución: aplicación móvil / encapsulada
       ↓
Operación: observabilidad y mejora continua
```

- Problema: centralizar usuarios, jornadas, apuestas, resultados y pagos de una peña.
- Alcance actual: backend API; no se presenta como producto final completo.
- Límites conscientes: frontend, aplicación móvil y observabilidad avanzada son evolución posterior.

**Qué explicar**

La API se ha diseñado como núcleo independiente del canal de consumo. Eso permite que el futuro frontend web y una posible aplicación móvil reutilicen el mismo contrato, reglas de negocio y sistema de seguridad.

**Ámbitos del Máster**: Arquitectura de software; proyecto backend con OpenAPI, Express y PostgreSQL.

---

### 4. Metodología: IA como apoyo, persona responsable

**En pantalla**

1. Definir una necesidad y los criterios de aceptación.
2. Pedir a la IA alternativas, explicaciones o una propuesta acotada.
3. Revisar la propuesta y decidir la solución.
4. Ejecutar los cambios de forma controlada.
5. Verificar con pruebas, documentación y ejecución real.
6. Documentar decisiones, incidencias y aprendizajes.

**Qué explicar**

La IA no sustituye la responsabilidad técnica: se ha usado como acelerador para estudiar, contrastar alternativas, elaborar documentación y asistir en la implementación. Cada cambio ha sido ejecutado y comprobado por mí; la validación procede de comandos, pruebas, contratos y despliegues reales.

**Apoyo visual**: diagrama circular «planificar → implementar → verificar → documentar» con la persona en el centro.

**Ámbitos del Máster**: IA en el proceso de aprendizaje; IA en el proceso de desarrollo; flujo de desarrollo híbrido IA + desarrollador.

---

### 5. Arquitectura de la solución

**En pantalla**

```text
Cliente actual / futuro (web o móvil)
              │ HTTPS + JSON
              ▼
     Express API — TypeScript
              │
   rutas → controladores → servicios → repositorios
              │
       PostgreSQL + Drizzle ORM
```

- Monolito modular: módulos de negocio separados por responsabilidad.
- Capas explícitas: HTTP, reglas de negocio y acceso a datos.
- `app.ts` separado de `server.ts` para facilitar pruebas de integración.
- Validación de entrada y documentación API vinculadas al código.

**Qué explicar**

Se ha optado por un monolito modular por adecuación al alcance: reduce complejidad operativa sin perder separación de responsabilidades. Cada módulo sigue una estructura consistente: esquemas, repositorio, servicio, controlador y rutas.

**Ámbitos del Máster**: Arquitectura de software; Clean Architecture con TypeScript; buenas prácticas y principios de diseño.

---

### 6. Tecnologías y criterio de selección

**En pantalla**

| Área         | Tecnologías                         | Papel en el proyecto                                     |
| ------------ | ----------------------------------- | -------------------------------------------------------- |
| Backend      | Node.js, TypeScript, Express        | API REST tipada y modular.                               |
| Persistencia | PostgreSQL, Drizzle ORM             | Datos relacionales, migraciones y restricciones.         |
| Contrato     | OpenAPI, Swagger UI, Spectral       | Documentación y validación del contrato HTTP.            |
| Calidad      | Vitest, Supertest, Insomnia         | Pruebas automatizadas y exploración manual reproducible. |
| Seguridad    | Argon2id, JWT, `jose`, Google OAuth | Identidad, sesiones y autorización.                      |
| Operación    | Docker, Caddy, GitHub Actions       | Entornos consistentes, HTTPS y automatización.           |

**Qué explicar**

No es una lista de herramientas: cada tecnología responde a una necesidad. Destacar TypeScript para robustez, PostgreSQL para integridad y OpenAPI como contrato común entre backend y futuros consumidores.

**Ámbitos del Máster**: TypeScript; herramientas de desarrollo; calidad; infraestructura y cloud.

---

### 7. Modelo de datos: visión de dominio

**En pantalla**

```text
Usuarios ──< invitaciones / sesiones
   │
   ├──< apuestas >── jornadas ──< partidos >── equipos
   ├──< pagos
   └──< cálculos / resultados

Temporadas organizan jornadas, partidos y reglas temporales.
```

**Qué explicar**

Presentar las áreas, no todas las columnas:

- **Identidad y acceso**: usuarios, invitaciones, sesiones/tokens y roles.
- **Competición**: temporadas, equipos, jornadas y partidos.
- **Participación**: apuestas y resultados.
- **Gestión económica**: pagos, saldos y crédito.
- **Explotación**: cálculos y dashboard.

Subrayar que reglas importantes se protegen en dos niveles: reglas de servicio y restricciones de base de datos.

**Apoyo visual**: sustituir el esquema simplificado por un diagrama ER generado desde el modelo real antes de la versión final.

**Ámbitos del Máster**: bases de datos; diseño de software; proyecto backend.

---

### 8. Funcionalidades implementadas

**En pantalla**

| Dominio        | Capacidades principales                                 |
| -------------- | ------------------------------------------------------- |
| Acceso         | Login local, OAuth con Google, invitaciones y roles.    |
| Configuración  | Gestión de usuarios, temporadas y equipos.              |
| Operación      | Jornadas, partidos, ventana de apuestas y resultados.   |
| Participación  | Creación y consulta de apuestas.                        |
| Gestión        | Cálculos, pagos, crédito y panel de resumen.            |
| Administración | Carga inicial de datos reales con proceso reproducible. |

**Qué explicar**

Escoger un ejemplo transversal: una jornada abre apuestas, los usuarios registran sus pronósticos, se cargan resultados, se calculan los aciertos y se actualiza el panel. Es una forma breve de demostrar que los módulos no son aislados.

**Ámbitos del Máster**: análisis de requisitos; arquitectura; desarrollo backend.

---

### 9. Contrato API y experiencia de integración

**En pantalla**

- Especificación OpenAPI generada desde el código.
- Swagger UI disponible para explorar endpoints y esquemas.
- Spectral valida la calidad de la especificación.
- Colección de Insomnia para probar flujos y roles.

**Qué explicar**

La API está pensada para ser consumida: la documentación no es un documento separado que pueda quedar obsoleto. Los esquemas de validación se reutilizan para describir peticiones y respuestas, y el contrato se comprueba en pruebas automatizadas.

**Apoyo visual**: captura de `/docs` o de un endpoint representativo con request, response y seguridad.

**Ámbitos del Máster**: APIs; documentación; calidad.

---

### 10. Seguridad por diseño

**En pantalla**

- Contraseñas con **Argon2id**: nunca se almacenan en claro.
- Access token JWT de vida corta.
- Refresh token opaco con **rotación** y detección de reutilización.
- Revocación y cierre de sesión.
- Registro cerrado mediante invitación.
- OAuth de Google mediante Authorization Code + PKCE.
- Roles, validación de entradas, rate limiting y cabeceras de seguridad.

**Qué explicar**

El flujo crítico es la renovación: un refresh token robado no se acepta indefinidamente. Al detectar reutilización se revoca su familia. Aclarar también que Google autentica la identidad, pero la aplicación mantiene sus propias reglas de acceso e invitación.

**Ámbitos del Máster**: desarrollo seguro; OWASP Top 10; security by design y security by default.

---

### 11. Calidad y estrategia de pruebas

**En pantalla**

```text
Contrato OpenAPI  ←→  pruebas de integración HTTP
                         │
                  PostgreSQL real efímero
```

- Vitest y Supertest para pruebas automatizadas.
- Base de datos PostgreSQL real y aislada para cada ejecución.
- Pruebas de autenticación, roles, errores y reglas de negocio.
- Validación de que las respuestas cumplen OpenAPI.
- Insomnia como complemento para pruebas exploratorias.

**Qué explicar**

El objetivo no es perseguir una métrica de cobertura sin significado; es proteger los flujos de negocio y el contrato público. Las pruebas descubrieron problemas reales de dependencias y configuración que un entorno local acumulado ocultaba.

**Ámbitos del Máster**: calidad; testing; TDD con IA (como práctica aplicable al flujo de trabajo).

---

### 12. Entornos de desarrollo y producción

**En pantalla**

| Aspecto       | Desarrollo                   | Producción                                                |
| ------------- | ---------------------------- | --------------------------------------------------------- |
| Configuración | `.env` local                 | `.env.prod` solo en servidor y con permisos restringidos. |
| Base de datos | Docker o PostgreSQL embebido | PostgreSQL en el stack Docker.                            |
| Ejecución     | Recarga durante desarrollo   | Imagen compilada y proceso no privilegiado.               |
| Acceso        | Herramientas locales         | HTTPS público a través de Caddy.                          |

**Qué explicar**

Explicar que los entornos comparten el mismo modelo de configuración, pero sus secretos y responsabilidades son distintos. La paridad de contenedores reduce el riesgo de que algo funcione solo en la máquina de desarrollo.

**Ámbitos del Máster**: Docker; infraestructura y cloud; gestión de configuración.

---

### 13. Despliegue automatizado y operación

**En pantalla**

```text
Push a GitHub
    ↓
CI: instalación limpia, calidad y pruebas
    ↓
Build y publicación de imagen
    ↓
Deploy por SSH al VPS
    ↓
Migraciones + arranque + health check
```

- Dockerfile multi-stage: compilación separada de runtime.
- GitHub Actions para CI y despliegue.
- VPS endurecido: acceso SSH con clave, firewall y Fail2ban.
- Caddy gestiona TLS/HTTPS.
- Copias de seguridad y restauración verificadas.

**Qué explicar**

No presentar el despliegue como «subir código»: es una cadena automatizada con controles. Mencionar que se resolvieron incidencias reales de permisos de GHCR, variables de entorno y migraciones, documentándolas para que el proceso sea repetible.

**Ámbitos del Máster**: DevOps y CI/CD; cloud computing; seguridad de infraestructura.

---

### 14. Decisiones y aprendizajes técnicos destacados

**En pantalla**

1. **Monolito modular**, por simplicidad operativa y separación interna.
2. **Contrato OpenAPI desde el código**, para reducir divergencia entre implementación y documentación.
3. **PostgreSQL real en pruebas**, para validar el comportamiento que interesa en producción.
4. **Rotación de refresh token**, para una sesión más defendible que un JWT de larga duración.
5. **Docker y CI desde temprano**, para detectar dependencias o configuraciones ocultas.

**Qué explicar**

Esta diapositiva es la defensa técnica ante preguntas del tribunal. Para cada decisión, explicar brevemente el problema que evitaba y la alternativa descartada. Evitar afirmar que una tecnología es «la mejor»: fue la más adecuada al contexto actual.

**Ámbitos del Máster**: pensamiento crítico; arquitectura; calidad; seguridad.

---

### 15. Plan de proyecto y ejecución

**En pantalla — completar por el autor**

Usar una línea temporal con hitos reales:

1. **[Análisis y diseño]**
2. **[Fundación técnica y autenticación]**
3. **[Módulos de negocio]**
4. **[Pruebas, documentación y contrato]**
5. **[Contenedores, CI/CD y producción]**
6. **[Carga de datos y validación final]**

**Qué explicar**

Relacionar la planificación inicial con la ejecución real: qué se hizo, qué cambió durante el trabajo y qué decisiones se tomaron para corregir desviaciones. El plan es evidencia de gestión, no solo un calendario.

**Ámbitos del Máster**: gestión de proyectos; flujo de desarrollo con IA; documentación y gestión del conocimiento.

---

### 16. Relación explícita con el Máster

**En pantalla**

| Ámbito cursado          | Evidencia en `quini-api`                                                |
| ----------------------- | ----------------------------------------------------------------------- |
| Desarrollo con IA       | Flujo híbrido: IA para apoyo, revisión humana y verificación ejecutada. |
| Arquitectura y diseño   | Monolito modular, capas y decisiones documentadas.                      |
| Backend                 | API REST con Express, TypeScript, PostgreSQL y OpenAPI.                 |
| Calidad                 | Pruebas de integración, contrato y automatización.                      |
| Seguridad               | Tokens, roles, invitaciones, OAuth, hardening de servidor.              |
| Infraestructura y cloud | Docker, CI/CD, VPS, HTTPS y backups.                                    |

**Qué explicar**

Este trabajo integra varios módulos del máster en un caso real. El valor no está en haber usado muchas herramientas, sino en conectarlas en un proceso coherente y verificable.

---

### 17. Próximos pasos

**En pantalla — completar y priorizar por el autor**

- Frontend web como primer cliente de la API.
- Empaquetado o evolución hacia aplicación móvil.
- Observabilidad: métricas, alertas, paneles y trazabilidad cuando el uso lo justifique.
- **[Otras mejoras funcionales o de producto]**.

**Qué explicar**

Separar lo implementado de la visión futura. El backend ya permite avanzar; los siguientes pasos se priorizarán por valor de producto y necesidades operativas reales.

**Ámbitos del Máster**: arquitectura evolutiva; observabilidad; desarrollo de producto.

---

### 18. Cierre

**En pantalla**

> `quini-api` transforma un dominio de gestión de quiniela en una API segura, documentada, probada y desplegada; la IA ha acelerado el proceso, pero la ingeniería y la validación han guiado cada decisión.

- Gracias.
- Preguntas.

**Qué explicar**

Recapitular en tres ideas: problema delimitado, solución técnica defendible y metodología responsable con IA.

---

## 4. Material visual que conviene preparar

| Elemento                    | Diapositiva | Fuente o forma de obtenerlo                                                    |
| --------------------------- | ----------: | ------------------------------------------------------------------------------ |
| Diagrama de arquitectura    |           5 | Redibujar a partir de `docs/00-Plan-inicial.md` y la estructura de `src/`.     |
| Diagrama entidad-relación   |           7 | Generar desde `src/db/schema/`; usar una versión simplificada para exposición. |
| Captura de Swagger UI       |           9 | Ejecutar la API y mostrar `/docs` con un endpoint representativo.              |
| Flujo de refresh token      |          10 | Adaptar el flujo de `docs/02-Autenticacion.md`.                                |
| Línea temporal del proyecto |          15 | Completar con las fechas y hitos reales del autor.                             |
| Pipeline de despliegue      |          13 | Simplificar `.github/workflows/ci.yml` y `deploy.yml`.                         |

## 5. Preguntas previsibles del tribunal

| Pregunta                                                    | Respuesta breve a preparar                                                                                                                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| ¿Por qué una API sin frontend?                              | Porque la API es el núcleo reutilizable; el frontend está planificado como siguiente cliente y no condiciona las reglas de negocio ni la seguridad. |
| ¿Por qué monolito y no microservicios?                      | El alcance y el volumen no justifican complejidad distribuida. La modularidad interna preserva una futura evolución.                                |
| ¿Cómo validas el uso de IA?                                 | La IA propone y acelera; las decisiones, ejecuciones, pruebas y validaciones son humanas y reproducibles.                                           |
| ¿Cómo proteges la sesión?                                   | Access token corto, refresh opaco rotado, detección de reutilización, revocación y controles de rol.                                                |
| ¿Cómo aseguras que la documentación no está desactualizada? | OpenAPI se genera desde los esquemas y rutas del código, se valida con Spectral y se contrasta en pruebas.                                          |
| ¿Qué queda pendiente?                                       | Clientes de interfaz, observabilidad y evolución funcional priorizada por uso real.                                                                 |

## 6. Antes de preparar la versión final

- [ ] Completar la presentación personal y la motivación.
- [ ] Confirmar tiempo máximo de exposición y ajustar el número de diapositivas.
- [ ] Generar el diagrama ER desde el esquema final de base de datos.
- [ ] Añadir capturas reales y legibles de Swagger, pruebas o pipeline.
- [ ] Completar el plan con fechas e hitos reales.
- [ ] Confirmar qué aspectos de observabilidad están implementados y cuáles son roadmap.
- [ ] Ensayar el discurso para evitar leer las diapositivas.

## Fuentes utilizadas para este borrador

- `docs/00-Plan-inicial.md` — arquitectura, modelo de datos, seguridad, testing, despliegue y observabilidad planificada.
- `docs/00-Plan-inicial-nuevos-servicios.md` — módulos de negocio, reglas y evolución funcional.
- `docs/02-Autenticacion.md` — flujos de acceso, tokens, roles, invitaciones y Google OAuth.
- `docs/03-OpenAPI.md`, `docs/04-Testing.md`, `docs/05-Insomnia.md` — contrato y calidad.
- `docs/09-Docker.md`, `docs/10-Configuracion-Despliegue-VPS.md`, `docs/11-Carga-de-datos.md` — operación, despliegue y datos iniciales.
- `/Users/jfernandez/Downloads/Máster en Desarrollo con IA - E.II (FD) | BIG school.pdf` — contenidos académicos del Máster.
