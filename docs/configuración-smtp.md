# Configuración del correo de quiniweb.com (iCloud + SMTP)

Resumen de cómo está montado el correo del dominio `quiniweb.com` y cómo envía correo la API (`quini-api`).

- **Recepción** de `@quiniweb.com`: iCloud+ (Correo de iCloud con dominio personalizado).
- **Envío desde la API**: configurable con `MAIL_TRANSPORT`, por **Gmail API** (por defecto) o por **SMTP** (iCloud, con remitente `admin@quiniweb.com`).
- **DNS**: zona gestionada en OVHcloud (`dns106.ovh.net` / `ns106.ovh.net`).

---

## 1. Registros DNS en OVHcloud

Cambio hecho el 2026-10-05 para pasar el correo de OVH a iCloud.

### Zona actual

Web Cloud → Nombres de dominio → `quiniweb.com` → Zona DNS → **Modificar en modo texto**:

```
$TTL 3600
@    IN SOA dns106.ovh.net. tech.ovh.net. (2090417007 86400 3600 3600000 60)
        IN NS     dns106.ovh.net.
        IN NS     ns106.ovh.net.
        IN MX     10 mx01.mail.icloud.com.
        IN MX     10 mx02.mail.icloud.com.
        IN A     92.222.69.239
        IN TXT     "v=spf1 include:icloud.com ~all"
        IN TXT     "apple-domain=YulQjNtwHRJTWm0s"
        IN TXT     "1|www.quiniweb.com"
api        IN A     92.222.69.239
app        IN A     92.222.69.239
ftp        IN CNAME     quiniweb.com.
sig1._domainkey        IN CNAME     sig1.dkim.quiniweb.com.at.icloudmailadmin.com.
www        IN A     92.222.69.239
www        IN TXT     "3|welcome"
```

| Registro                                         | Para qué sirve                                                                                        |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `MX 10 mx01/mx02.mail.icloud.com.`               | El correo entrante de `@quiniweb.com` llega a iCloud.                                                 |
| `TXT apple-domain=…`                             | Verifica ante Apple que el dominio es nuestro.                                                        |
| `TXT v=spf1 include:icloud.com ~all`             | **SPF**: autoriza a iCloud a enviar en nombre de `quiniweb.com`. Debe haber **un solo** registro SPF. |
| `CNAME sig1._domainkey`                          | **DKIM**: iCloud firma los correos salientes; evita que acaben en spam.                               |
| `TXT 1\|www.quiniweb.com` y `www TXT 3\|welcome` | Redirecciones web propias de OVH. **No tocar.**                                                       |

### Zona anterior (copia de seguridad)

Por si hay que volver al correo de OVH:

```
$TTL 3600
@    IN SOA dns106.ovh.net. tech.ovh.net. (2090417007 86400 3600 3600000 60)
        IN NS     dns106.ovh.net.
        IN NS     ns106.ovh.net.
        IN MX     1 mx1.mail.ovh.net.
        IN MX     5 mx2.mail.ovh.net.
        IN MX     100 mx3.mail.ovh.net.
        IN A     92.222.69.239
        IN TXT     "v=spf1 include:mx.ovh.com -all"
        IN TXT     "1|www.quiniweb.com"
api        IN A     92.222.69.239
app        IN A     92.222.69.239
ftp        IN CNAME     quiniweb.com.
www        IN A     92.222.69.239
www        IN TXT     "3|welcome"
```

OVH también guarda un **historial de la zona DNS** (pestaña Zona DNS) desde el que se puede restaurar una versión anterior.

### Notas al editar en OVH

- Host `@` de Apple = subdominio **vacío** en OVH.
- Los destinos (MX, CNAME) terminan en **punto** (`mx01.mail.icloud.com.`); si no, OVH les añade `.quiniweb.com`.
- En el formulario, los TXT se escriben **sin comillas**; OVH las pone.
- El número de serie del SOA lo actualiza OVH solo.

### Comprobar la propagación

```bash
dig +short quiniweb.com MX
dig +short quiniweb.com TXT
dig +short sig1._domainkey.quiniweb.com CNAME
# Sin caché, preguntando directamente al DNS de OVH:
dig +short quiniweb.com MX @dns106.ovh.net
```

---

## 2. iCloud+ (dominio personalizado)

- Configuración en **icloud.com/settings → Dominio de correo personalizado → quiniweb.com**.
- El dominio va asociado a la cuenta de Apple personal del administrador (suscripción iCloud+). Si la suscripción se cancela, el correo deja de funcionar.
- Direcciones del dominio (por ejemplo `admin@quiniweb.com`) se añaden desde esa misma pantalla. Hasta 3 por usuario.
- Al añadir una dirección, Apple envía un correo de verificación **a esa misma dirección**. Llega a icloud.com/mail o a la app Mail; si no aparece, revisar Correo no deseado y, durante las primeras horas tras cambiar los MX, el webmail antiguo de OVH (`mail.ovh.net`).

### Leer y enviar desde clientes de correo

- **iPhone / iPad / Mac**: nada que configurar si iCloud Mail está activado (Ajustes → [nombre] → iCloud → Correo de iCloud). Para enviar como `@quiniweb.com`, elegirla en el campo **De**.
- **Otros clientes** (Outlook, Thunderbird, Android):

|                 | Servidor           | Puerto | Seguridad |
| --------------- | ------------------ | ------ | --------- |
| Entrante (IMAP) | `imap.mail.me.com` | 993    | SSL/TLS   |
| Saliente (SMTP) | `smtp.mail.me.com` | 587    | STARTTLS  |

Usuario: la dirección principal `@icloud.com` (no la `@quiniweb.com`). Contraseña: una contraseña específica de app (ver abajo).

---

## 3. Contraseña específica de app (`SMTP_PASS`)

La API **no** usa la contraseña de la cuenta de Apple, sino una contraseña específica de app. Solo da acceso a correo/contactos/calendario por IMAP/SMTP y se puede revocar en cualquier momento.

1. Entrar en **account.apple.com** (con la cuenta de Apple; su identificador puede ser un Gmail).
   - Si no se recuerda la contraseña: entrar con passkey / aprobación desde el iPhone, cambiarla en el iPhone (**Ajustes → [nombre] → Inicio de sesión y seguridad → Cambiar contraseña**, solo pide el código del iPhone) o recuperarla en **iforgot.apple.com**.
   - **Cambiar la contraseña principal anula todas las contraseñas específicas de app**: hay que generar de nuevo la de la API y actualizar los `.env`.
2. **Inicio de sesión y seguridad → Contraseñas específicas de apps → Generar**, con nombre `quini-api`.
3. Copiar la contraseña (`xxxx-xxxx-xxxx-xxxx`). No se puede volver a ver; si se pierde, se genera otra.

**Nunca** se sube al repositorio: solo va en el `.env` local y en el `.env` del VPS. Si se filtra, se revoca desde la misma pantalla.

---

## 4. Envío de correo en la API

### Elegir transporte

Variable `MAIL_TRANSPORT` en el `.env`:

| Valor                 | Envía por          | Variables que usa                                                                       |
| --------------------- | ------------------ | --------------------------------------------------------------------------------------- |
| `gmail` (por defecto) | Gmail API + OAuth2 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER_EMAIL` |
| `smtp`                | SMTP (nodemailer)  | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`                         |

- Se lee **al arrancar**: tras cambiarla hay que reiniciar la API.
- Con `MAIL_TRANSPORT=smtp`, si falta `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` o `MAIL_FROM`, la API **no arranca** y dice cuál falta.
- Se pueden tener las variables de ambos transportes a la vez y cambiar solo `MAIL_TRANSPORT`.

### Configuración SMTP con iCloud

```env
MAIL_TRANSPORT=smtp
MAIL_FROM="Quiniweb <admin@quiniweb.com>"
SMTP_HOST=smtp.mail.me.com
SMTP_PORT=587
SMTP_USER=<dirección principal @icloud.com>
SMTP_PASS=<contraseña específica de app>
```

- `SMTP_USER`: la dirección `@icloud.com` principal, aunque la cuenta de Apple se identifique con un Gmail. Se ve en icloud.com/settings → Correo de iCloud.
- `MAIL_FROM`: debe ser una dirección **dada de alta** en el dominio personalizado de iCloud; si no, iCloud rechaza el envío.
- `SMTP_PORT`: 587 negocia STARTTLS (obligatorio). Con 465 se usaría TLS implícito.
- Límite de iCloud: unos 1.000 correos al día. Suficiente para el boletín.

### Código

| Fichero                     | Qué hace                                                              |
| --------------------------- | --------------------------------------------------------------------- |
| `src/modules/mail/index.ts` | Punto único `sendMail()`; elige el transporte según `MAIL_TRANSPORT`. |
| `src/modules/mail/gmail.ts` | Envío por Gmail API.                                                  |
| `src/modules/mail/smtp.ts`  | Envío por SMTP con nodemailer.                                        |
| `src/config/env.ts`         | Declaración y validación de las variables.                            |

Quien envía correo importa siempre desde `mail/index.js`, nunca desde un transporte concreto.

### Endpoints del boletín (solo admin)

| Endpoint                      | Destinatarios                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/boletin/prueba` | Solo el admin autenticado. Para revisar el boletín antes de enviarlo. Si el envío falla, devuelve error. |
| `POST /api/v1/boletin/enviar` | Todos los usuarios. Devuelve `{ enviados, fallidos }`.                                                   |

Ambos reciben `{ "subject": "...", "html": "..." }`.

---

## 5. Probar

1. Configurar el `.env` local (sección 4).
2. Enviar un correo de prueba con el transporte configurado:
   ```bash
   npm run mail:test -- --to=destinatario@gmail.com
   ```
3. En Gmail: abrir el correo → **⋮ → Mostrar original**. Debe indicar **SPF: PASS** y **DKIM: PASS**, con remitente `admin@quiniweb.com`.
4. Probar `POST /api/v1/boletin/prueba` con un token de admin.

### Errores habituales

| Error                                                               | Causa                                                                                                                                |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Invalid login: 550 5.1.1 Mailbox does not exist` (en `AUTH PLAIN`) | `SMTP_USER` no es un buzón de iCloud: suele ser el Gmail con el que se entra en la cuenta de Apple. Usar la dirección `@icloud.com`. |
| `Invalid login: 535`                                                | Contraseña incorrecta: usar una contraseña específica de app, no la de la cuenta de Apple.                                           |
| `553` / remitente no permitido                                      | `MAIL_FROM` no está dada de alta en el dominio personalizado de iCloud.                                                              |
| La API no arranca y pide variables `SMTP_*` / `MAIL_FROM`           | `MAIL_TRANSPORT=smtp` con alguna variable vacía.                                                                                     |

---

## 6. Producción (VPS)

1. Añadir las variables SMTP al `.env` del VPS.
2. Poner `MAIL_TRANSPORT=smtp` y reiniciar el contenedor.
3. Enviar un boletín de prueba con `/boletin/prueba`.

**Marcha atrás**: `MAIL_TRANSPORT=gmail` y reiniciar.

---

## 7. A tener en cuenta

- **Gmail con remitente `@quiniweb.com`**: si se usa `MAIL_TRANSPORT=gmail` con un remitente del dominio (alias "Enviar como" en Gmail), el SPF debe incluir también a Google: `v=spf1 include:icloud.com include:_spf.google.com ~all`. Con remitente `@gmail.com` no hace falta.
- **Servicio transaccional** (Resend, Brevo, Mailgun, Amazon SES): alternativa si no se quiere depender de la cuenta personal de Apple. Ofrecen SMTP, así que bastaría cambiar `SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`, añadir su DKIM en OVH y su `include:` al SPF. La recepción seguiría en iCloud.
- **Contacto de la cuenta OVH**: no usar una dirección `@quiniweb.com`. Si el dominio caduca o el DNS falla, no llegarían los avisos de renovación ni la recuperación de cuenta. Usar un correo de otro dominio.
- **Correo antiguo de OVH**: con los MX en iCloud, los buzones y redirecciones de OVH ya no reciben nada. Revisar en Web Cloud → Emails si hay una oferta de pago que cancelar (guardando antes lo que interese).
