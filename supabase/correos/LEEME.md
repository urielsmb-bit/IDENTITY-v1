# Los correos de la cuenta

Supabase manda tres correos por sharee: confirmar el registro, cambiar la
contraseña y cambiar de correo. Aquí están los tres, en español y con la marca,
y cómo hacer que salgan desde `no-reply@sharee.fun`.

## Por qué hace falta

El correo que trae Supabase de serie **solo envía a los miembros del equipo del
proyecto**. A cualquier otra dirección contesta «Email address not authorized».
Y el proyecto exige confirmar el correo al registrarse, así que sin un servidor
propio **nadie que se registre con email puede entrar**. Además tiene un tope de
2 correos por hora y Supabase dice que no es para producción.

## 1 · Resend (gratis: 3.000 al mes, 100 al día)

1. Crea la cuenta en resend.com.
2. **Domains → Add Domain → `sharee.fun`**.
3. Añade los registros que te enseña. Si ofrece conectar con Cloudflare, deja
   que los ponga él.
   - Van todos en **`send.sharee.fun`** y en `resend._domainkey`, no en la raíz,
     así que **no tocan** el correo que ya recibes con Cloudflare.
   - **No añadas un segundo SPF en `sharee.fun`**. Dos SPF en el mismo nombre
     anulan los dos.
4. Espera a que ponga **Verified**.

## 2 · Supabase

**La forma fácil:** en Resend, **Settings → Integrations → Supabase**. Conecta tu
proyecto y rellena el SMTP solo, sin que tengas que copiar ninguna clave.

**A mano,** si no aparece: en Resend crea una API key con permiso **Sending
access** limitado a `sharee.fun`. Luego, en Supabase, **Authentication → Emails →
SMTP Settings → Enable Custom SMTP**:

| Campo | Valor |
|---|---|
| Sender email | `no-reply@sharee.fun` |
| Sender name | `sharee` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la API key (pégala solo aquí) |

## 3 · Los textos

En Supabase, **Authentication → Emails → Templates**. En cada uno pega el asunto
y el HTML del fichero entero:

| Plantilla de Supabase | Asunto | Fichero |
|---|---|---|
| Confirm signup | `Confirma tu correo en sharee` | `confirmar-registro.html` |
| Reset password | `Cambia tu contraseña de sharee` | `cambiar-clave.html` |
| Change email address | `Confirma tu nuevo correo en sharee` | `cambiar-correo.html` |

Las `{{ .ConfirmationURL }}`, `{{ .Email }}` y `{{ .NewEmail }}` se quedan tal
cual: Supabase las cambia por el enlace y las direcciones de verdad.

## 4 · Probarlo

En `sharee.fun/entrar`, «¿Olvidaste tu contraseña?» con un correo tuyo. Tiene que
llegar desde `no-reply@sharee.fun`, en español y con el botón negro. Si cae en
spam, márcalo como «No es spam»: con el DKIM de Resend y el DMARC ya puesto,
deja de pasar en unos días.
