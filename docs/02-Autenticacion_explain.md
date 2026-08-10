# Autenticación en `quini-api` — guía introductoria

Este documento es una **introducción educativa** al sistema de autenticación de `quini-api`.

Su objetivo no es entrar en cada detalle técnico, sino ayudarte a entender **qué problema resuelve la autenticación**, **qué piezas intervienen**, **cómo se relacionan entre sí** y **por qué la implementación está diseñada así**.

Si después quieres profundizar en el detalle técnico, puedes leer el documento de referencia: `/Users/jfernandez/Desarrollo/Proyectos/quini-api/docs/02-Autenticacion.md`.

---

## Qué debes entender primero

Cuando una API tiene usuarios, normalmente necesita responder a estas dos preguntas:

1. **¿Quién eres?**  
   Esto es la **autenticación**.

2. **¿Qué puedes hacer?**  
   Esto es la **autorización**.

Aunque suenan parecidas, no son lo mismo.

### Ejemplo simple

- Si un usuario intenta entrar en la API con su email y contraseña, la API necesita comprobar su identidad. Eso es **autenticación**.
- Si después ese usuario intenta acceder a una acción reservada a administradores, la API necesita comprobar si tiene permisos. Eso es **autorización**.

En `quini-api` ambas cosas están separadas, lo cual es una buena decisión de diseño porque hace el sistema más claro, mantenible y seguro.

---

## Idea general del sistema

La autenticación de `quini-api` está pensada para que:

- el usuario pueda iniciar sesión de forma segura,
- la API no tenga que pedir la contraseña en cada petición,
- las sesiones puedan durar bastante tiempo sin perder seguridad,
- se puedan revocar accesos cuando sea necesario,
- y se pueda controlar qué usuarios tienen permisos de administración.

Para conseguirlo, el sistema combina varios conceptos:

- **contraseña segura** para el login clásico,
- **access token** para autenticarse en las peticiones normales,
- **refresh token** para renovar la sesión sin volver a pedir contraseña,
- **roles** para decidir permisos,
- **invitaciones** para controlar quién puede registrarse,
- y **login con Google** como vía alternativa de entrada.

---

## El mapa mental más importante

Puedes imaginar el sistema así:

### 1. Entrada

El usuario demuestra quién es:

- con **email + contraseña**, o
- con **Google**.

### 2. Sesión

Si todo va bien, la API entrega dos tokens:

- un **access token**: dura poco y se usa en las peticiones normales,
- un **refresh token**: dura más y sirve para conseguir nuevos access tokens.

### 3. Protección

Cuando el usuario llama a una ruta protegida:

- la API valida el access token,
- identifica al usuario,
- y mira su rol si la ruta necesita permisos especiales.

### 4. Renovación

Cuando el access token caduca:

- el cliente usa el refresh token,
- la API emite un nuevo access token,
- y además reemplaza el refresh token por otro nuevo.

Esta última parte es muy importante porque mejora mucho la seguridad.

---

## Los conceptos clave, explicados de forma sencilla

### 1. Contraseña

La contraseña es el secreto inicial del usuario.

Pero una API bien diseñada **nunca guarda la contraseña en texto plano**. En su lugar, guarda una versión transformada y protegida llamada **hash**.

En `quini-api` se usa **Argon2id**, que es un algoritmo moderno y recomendado para proteger contraseñas.

### Qué idea debes quedarte

- El servidor **no debería poder leer tu contraseña original**.
- Solo debería poder comprobar si la contraseña que escribes ahora coincide con la que se registró en su momento.

Eso reduce mucho el daño si algún día hubiera una filtración de base de datos.

---

### 2. Access token

El **access token** es la credencial que el cliente usa en las peticiones autenticadas.

Piensa en él como una especie de “pase temporal”.

### Para qué sirve

En vez de enviar email y contraseña en cada request, el cliente envía este token en la cabecera `Authorization`.

La API lo verifica y, si es válido, sabe quién es el usuario.

### Por qué dura poco

En `quini-api` el access token tiene una vida corta. La idea es simple:

- si alguien roba ese token,
- solo podrá usarlo durante un tiempo limitado.

Eso reduce la ventana de riesgo.

### Qué suele contener

Aunque aquí no hace falta memorizar todos los campos, sí conviene entender que el token incluye información como:

- quién es el usuario,
- cuál es su email,
- cuál es su rol,
- quién emitió el token,
- para qué audiencia fue creado,
- y cuándo caduca.

La ventaja es que la API puede validar rápidamente el token sin consultar la base de datos en cada petición.

---

### 3. Refresh token

El **refresh token** sirve para mantener la sesión viva sin obligar al usuario a introducir su contraseña una y otra vez.

### Diferencia con el access token

- **Access token**: se usa mucho, dura poco.
- **Refresh token**: se usa pocas veces, dura mucho más.

### Qué problema resuelve

Si el access token caduca cada pocos minutos, la experiencia del usuario sería muy mala si tuviera que iniciar sesión constantemente.

El refresh token evita eso.

Cuando el access token ya no vale, el cliente presenta el refresh token y la API entrega uno nuevo.

### Idea importante

El refresh token no está pensado para viajar constantemente en todas las peticiones. Se usa solo para renovar la sesión.

---

### 4. Rotación de refresh token

Este es uno de los conceptos más valiosos del sistema.

En `quini-api`, cuando usas un refresh token, **ese refresh token deja de valer** y se emite otro nuevo.

A esto se le llama **rotación**.

### Por qué es buena idea

Imagina que alguien roba un refresh token.

Si ese token siguiera siendo válido durante 30 días, el atacante podría usarlo tranquilamente durante todo ese tiempo.

Con rotación, la situación mejora:

- el token viejo se invalida al usarse,
- aparece uno nuevo,
- y si alguien intenta reutilizar el antiguo, eso se interpreta como una señal de riesgo.

### Qué hace el sistema cuando detecta reuso

Si un refresh token ya invalidado vuelve a aparecer, la API asume que la sesión puede estar comprometida y revoca la familia completa de esa sesión.

Esto es una defensa muy potente y muestra que el diseño no busca solo “que funcione”, sino que también intenta anticipar ataques realistas.

---

### 5. Revocación y logout

Cerrar sesión no es solo “olvidar el token en el cliente”.

En el servidor también hay que dejar constancia de que ciertos tokens ya no deben aceptarse.

En `quini-api` existen mecanismos para:

- revocar un refresh token concreto,
- cerrar la sesión actual,
- o invalidar una familia completa de tokens cuando se detecta un problema.

### Idea a retener

El access token vive poco y normalmente expira solo.

El control fino de seguridad se apoya sobre todo en el refresh token, porque ese sí está gestionado por el servidor y puede revocarse.

---

### 6. Autorización por rol

Autenticarse no significa poder hacerlo todo.

Después de identificar al usuario, la API puede comprobar su **rol**.

En este sistema, los roles principales son:

- `user`
- `admin`

### Ejemplo mental

- Un usuario normal puede consultar información propia.
- Un administrador puede además gestionar invitaciones o tareas reservadas.

### Lo importante conceptualmente

La autenticación responde a “quién eres”.  
La autorización responde a “qué puedes hacer”.

Separar estas dos fases evita errores conceptuales y técnicos.

---

### 7. Registro cerrado mediante invitaciones

`quini-api` no permite un registro público abierto sin control.

Eso significa que no cualquiera puede crearse una cuenta libremente.

Para registrarse, hace falta una **invitación previa**.

### Qué aporta esto

- controla quién entra en el sistema,
- evita altas no autorizadas,
- y encaja bien con una aplicación donde el acceso está limitado.

### Cómo funciona a nivel conceptual

1. Un administrador genera una invitación.
2. Esa invitación va asociada a un email.
3. El usuario usa esa invitación para completar su alta.
4. Una vez usada, la invitación deja de estar disponible.

Esto evita reutilizaciones indebidas y ayuda a mantener el control del acceso.

---

### 8. Login con Google

Además del login con contraseña, `quini-api` soporta autenticación con Google.

La idea no es “delegar toda la seguridad en Google”, sino usar Google como forma de **demostrar identidad**.

Después, la API sigue emitiendo sus propios tokens y sigue aplicando sus propias reglas.

### Qué debes entender

Google confirma quién eres.  
Pero la sesión final dentro de `quini-api` la sigue controlando `quini-api`.

Es decir:

- Google valida la identidad externa.
- La API decide si esa persona puede entrar.
- La API emite sus propios tokens.

### Por qué esto es importante

Así se mantiene una arquitectura coherente:

- el proveedor externo autentica,
- pero el control de sesión y permisos sigue siendo interno.

---

## Los flujos principales

### Flujo A — Login con email y contraseña

Este es el recorrido básico:

1. El usuario envía su email y contraseña.
2. La API busca al usuario.
3. La API verifica la contraseña contra el hash guardado.
4. Si todo es correcto, emite:
   - un access token,
   - y un refresh token.
5. El cliente guarda esos tokens para usarlos después.

### Qué aprendizaje hay aquí

El login no termina en “sí o no”.  
Si sale bien, el sistema crea una sesión segura basada en tokens.

---

### Flujo B — Acceso a una ruta protegida

1. El cliente hace una petición a una ruta protegida.
2. Envía el access token en la cabecera.
3. La API valida el token.
4. Si el token es correcto, deja pasar la petición.
5. Si no lo es, devuelve un error de autenticación.

### Qué aprendizaje hay aquí

La contraseña no participa en cada request.  
Solo participa en el momento inicial del login.

Eso mejora la seguridad y el rendimiento.

---

### Flujo C — Renovación de sesión

1. El access token expira.
2. El cliente usa el refresh token.
3. La API comprueba si sigue siendo válido.
4. Si lo es, emite un nuevo access token.
5. Además, rota el refresh token.

### Qué aprendizaje hay aquí

La sesión puede durar mucho tiempo sin volver a pedir contraseña, pero sin renunciar al control de seguridad.

---

### Flujo D — Logout o revocación

1. El usuario cierra sesión o el sistema detecta un problema.
2. La API revoca tokens relevantes.
3. A partir de ese momento, ya no deben aceptarse para renovar sesión.

### Qué aprendizaje hay aquí

Un sistema de autenticación real no solo crea sesiones: también debe saber **terminarlas bien**.

---

### Flujo E — Registro por invitación

1. Un admin crea una invitación.
2. El usuario invitado la usa para registrarse.
3. Establece su contraseña o accede por el método permitido.
4. La cuenta queda creada con el rol correspondiente.

### Qué aprendizaje hay aquí

La autenticación no empieza siempre en el login.  
También empieza en cómo decides quién puede convertirse en usuario del sistema.

---

### Flujo F — Login con Google

1. El usuario elige entrar con Google.
2. Google confirma su identidad.
3. `quini-api` comprueba si esa persona ya tiene cuenta o invitación válida.
4. Si todo encaja, la API emite sus propios tokens.

### Qué aprendizaje hay aquí

Autenticación externa no significa perder el control del acceso interno.

---

## Cómo está organizada la implementación

A nivel de código, el sistema sigue una separación por capas. Eso es muy buena noticia para aprender, porque cada pieza tiene una responsabilidad clara.

### Rutas

Las rutas definen los endpoints y qué validaciones o middlewares usa cada uno.

Aquí se decide, por ejemplo:

- qué URL existe,
- qué método HTTP usa,
- y si necesita autenticación o validación previa.

### Controladores

Los controladores reciben la petición HTTP y preparan la respuesta.

Su papel no debería ser contener toda la lógica. Más bien coordinan.

### Servicios

Los servicios contienen las reglas de negocio principales.

Aquí vive la parte importante de decisiones como:

- verificar credenciales,
- emitir tokens,
- rotar refresh tokens,
- detectar reuso,
- o aplicar reglas de registro.

### Repositorios

Los repositorios hablan con la base de datos.

Su función es leer y escribir datos, no decidir reglas de negocio.

### Middlewares

Los middlewares permiten reutilizar lógica transversal, como:

- verificar el token,
- comprobar roles,
- limitar intentos,
- o gestionar errores.

### Qué aprendizaje arquitectónico hay aquí

La autenticación no está “mezclada en un solo archivo”.  
Está separada por responsabilidades, y eso hace más fácil:

- entender el sistema,
- probarlo,
- cambiar piezas,
- y localizar errores.

---

## Medidas de seguridad que merece la pena entender

Aunque este documento sea introductorio, hay varias decisiones de seguridad que conviene identificar desde ya.

### 1. No guardar contraseñas en claro

Es una base imprescindible.

#### 2. Access tokens de vida corta

Reduce el impacto si se filtran.

#### 3. Refresh tokens revocables

Permiten control sobre sesiones largas.

#### 4. Rotación de refresh tokens

Reduce el valor de un token robado.

### 5. Detección de reuso

Permite sospechar compromiso de sesión.

### 6. Rate limiting

Evita que alguien pruebe credenciales masivamente.

### 7. Verificación estricta de tokens

No basta con que “parezca un token válido”; debe haber sido emitido por quien toca y para el servicio correcto.

### 8. Registro cerrado por invitación

El acceso al sistema se controla desde el origen.

---

## Errores típicos de concepto que este sistema evita

Este punto es muy útil para estudiar.

### Confundir autenticación con autorización

Aquí están separadas.

### Guardar contraseñas de forma insegura

Aquí se usan hashes modernos.

### Usar un único token largo para todo

Aquí se separa access token y refresh token.

### No poder invalidar sesiones

Aquí existe revocación.

### Aceptar cualquier login social sin reglas propias

Aquí Google no abre automáticamente la puerta; la API mantiene sus condiciones.

### Hacer un sistema funcional pero poco defendible

Aquí hay decisiones que también se sostienen bien a nivel de explicación técnica.

---

## Qué deberías ser capaz de explicar después de leer esto

Si has entendido bien esta guía, deberías poder explicar con tus propias palabras:

- qué diferencia hay entre autenticación y autorización,
- por qué una API usa tokens en vez de pedir contraseña siempre,
- para qué sirve un access token,
- para qué sirve un refresh token,
- qué significa rotar un refresh token,
- por qué detectar reuso mejora la seguridad,
- por qué un login con Google no elimina las reglas internas de la API,
- y por qué la arquitectura separa rutas, controladores, servicios y repositorios.

---

## Resumen final

La autenticación de `quini-api` no es solo un “login que funciona”.

Es un sistema diseñado para combinar:

- **seguridad**,
- **buena experiencia de uso**,
- **control del acceso**,
- y **claridad arquitectónica**.

La idea central es esta:

- el usuario se identifica una vez,
- recibe credenciales temporales,
- la API valida esas credenciales en cada petición,
- y el sistema mantiene el control mediante renovación, revocación y permisos.

Si quieres seguir aprendiendo, el siguiente paso natural es leer el documento técnico original y relacionar cada concepto de esta guía con su implementación real en código.

---

## Siguiente paso recomendado

Cuando te sientas cómodo con esta introducción, lee el documento técnico y haz este ejercicio:

1. Busca dónde se hace el login.
2. Busca dónde se valida el access token.
3. Busca dónde se rota el refresh token.
4. Busca dónde se comprueba el rol.
5. Intenta conectar cada archivo con su responsabilidad.

Ese salto desde “entiendo la idea” a “sé ubicarlo en el código” es justo donde más se aprende.
