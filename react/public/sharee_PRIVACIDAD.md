# sharee — Política de privacidad

> **Versión 2026-09-25** · **En vigor desde el 25 de septiembre de 2026**
>
> **Responsable:** sharee, un proyecto operado por una persona natural residente
> en **Colombia**.
> **Contacto:** **hello@sharee.fun**
>
> Está escrita para que sea clara y honesta, no para que suene a abogado. Dice lo
> que el sitio hace de verdad, no lo que queda bien decir.

---

## Lo corto

- **Tu perfil es público.** Todo lo que pongas en él lo puede ver cualquiera, y
  puede aparecer en Descubrir y en los rankings. Esa es la finalidad del
  producto: compartir tus enlaces.
- **No vendemos tus datos** ni los cedemos a anunciantes.
- **Si vinculas Discord o Spotify, guardamos lo mínimo** para enseñar lo que has
  pedido enseñar, y puedes desvincularlos cuando quieras.
- **Puedes borrar tu cuenta**, y con ella se va todo: perfil, imágenes, vídeo y
  vínculos.

---

## 1. Qué guardamos y por qué

### 1.1 · Lo que creas tú

| Dato | Para qué | Visible |
|---|---|---|
| Nombre de usuario (`@algo`) | Es la dirección de tu perfil | **Público** |
| Nombre, biografía, oficio, ubicación, enlaces | Es el contenido de tu perfil | **Público** |
| Apariencia (tema, colores, tipografías, posiciones) | Cómo se ve tu perfil | **Público** |
| Avatar, imagen de fondo, vídeo de fondo | Es el contenido de tu perfil | **Público** |

Todo esto lo pones tú y todo esto se ve. **No escribas ahí nada que no quieras
que lea un desconocido**: dirección, teléfono, documento de identidad, el
colegio al que vas. Un perfil de sharee es una página pública, como una
cuenta abierta de cualquier red social.

### 1.2 · Lo que hace falta para tener cuenta

| Dato | Para qué | Visible |
|---|---|---|
| Correo electrónico | Entrar, recuperar la cuenta, avisarte de algo importante | **No** |
| Contraseña | Solo se guarda cifrada; nadie, tampoco nosotros, puede leerla | **No** |
| Fecha de alta y de última edición | Antigüedad de la cuenta y orden en Descubrir | Parcial |
| Si compras Premium: el número de la compra, el importe, la moneda y la fecha | Darte el plan, y retirarlo si el pago se devuelve | **No** |

Los datos de pago —tarjeta, nombre de facturación, dirección— no llegan a
sharee: los pide y los guarda **Tebex**, que es quien cobra (ver el apartado 4).

### 1.3 · Lo que se mide

| Dato | Para qué | Visible |
|---|---|---|
| Visitantes únicos de tu perfil | Contador público y orden en Descubrir | Contador público |
| Cuántas veces ha vuelto cada visitante | Tus estadísticas | Solo tú |
| Clics en tus enlaces (agregados) | Que sepas qué enlace funciona | Solo tú |
| Valoraciones que te deja el público | Nota y orden en Descubrir | Nota pública |
| Dirección IP, de forma momentánea | Distinguir un visitante de otro y frenar abusos | **No** |

### Cómo contamos las visitas, en concreto

Una persona cuenta **una sola vez** en el contador público, vuelva las veces que
vuelva. Para poder saber que eres la misma persona sin guardar quién eres,
hacemos esto:

- Al entrar en un perfil, el servidor toma tu dirección de red y tu navegador,
  los mezcla con el identificador de ese perfil y con un secreto que solo conoce
  el servidor, y calcula una **huella irreversible**.
- **Guarda la huella y descarta la dirección de red.** En ninguna tabla queda una
  IP en claro.
- Esa huella lleva dentro el identificador del perfil, así que **la misma persona
  produce huellas distintas en perfiles distintos**. No podemos seguirte de un
  perfil a otro, ni saber qué perfiles has visitado.
- De cada huella guardamos solo tres cosas: cuándo apareció por primera vez,
  cuándo por última, y cuántas veces ha vuelto. El dueño del perfil ve ese
  recuento; nadie ve quién eres, porque nosotros tampoco lo sabemos.

**Es una aproximación, no una verdad.** Si cambias de red cuentas como dos
personas; si dos personas comparten la misma red, pueden contar como una. No hay
forma de hacerlo exacto sin identificarte, y preferimos no identificarte.

No usamos cookies para esto, ni te pedimos que inicies sesión para visitar un
perfil.

### 1.4 · Tu sesión

Mientras estás dentro guardamos un registro de sesión: un identificador ligado a
tu cuenta, el tipo de navegador o dispositivo, el país aproximado y la dirección
de red. Sirve para mantenerte dentro, detectar accesos raros y que puedas cerrar
sesiones abiertas. La sesión desaparece al caducar o al cerrarla.

### 1.5 · Cuando algo falla

Si la página da un error, guardamos un registro breve para poder arreglarlo: qué
falló, tu identificador de cuenta si habías entrado, y el navegador o dispositivo.
**Estos registros no se usan para publicidad ni para seguirte**, solo para
reparar averías y frenar abusos.

### 1.6 · Cookies

**No usamos cookies de publicidad, de analítica ni de seguimiento de terceros.**

Sí usamos las estrictamente necesarias: mantenerte dentro, proteger tu cuenta y
que funcione lo básico. Esas no se pueden desactivar sin romper el servicio.

Además, **Cloudflare** —que está delante de la página para repartir el tráfico y
defenderla de ataques— puede poner sus propias cookies técnicas. Son necesarias
para que el sitio esté disponible, y no sirven para identificarte ni para
perfilarte.

**Hoy no hay ninguna comprobación anti‑robots** —ni captcha, ni casillas de «no
soy un robot»—. Si algún día hiciera falta una contra el spam, lo diremos aquí
antes de ponerla, y solo se usaría para distinguir a una persona de un programa,
nunca para perfilarte.

---

## 2. Discord y Spotify

Vincular estas cuentas es **opcional**. El perfil funciona sin ellas. Si las
vinculas, esto es exactamente lo que pasa.

### 2.1 · Discord

Pedimos dos permisos, los dos básicos: `identify` y `email`. **No pedimos acceso
a tus mensajes, ni a tus servidores, ni a tus amigos.**

Con `identify` recibimos y guardamos:

- tu identificador de Discord,
- tu nombre para mostrar,
- tu **avatar** y tu **decoración de avatar** (el marco),
- tu banner y tu color de acento,
- tus insignias públicas.

Con `email` recibimos **tu dirección de correo**, y solo para una cosa: que tu
cuenta se pueda recuperar. Sin ella, el día que perdieras el acceso a tu Discord
perderías también tu perfil, sin forma de demostrar que es tuyo. Ese correo no
es público y no se usa para publicidad.

Se guarda para poder pintar tu perfil con ello. Estos datos se refrescan cuando
vuelves a entrar; si cambias tu avatar en Discord, aquí cambia también.

**No leemos tu actividad ni tu estado.** Saber a qué juegas o qué escuchas en
tiempo real exige un bot y un servidor compartido, y hemos decidido no ir por
ahí.

Las decoraciones de avatar son elementos de Discord, propiedad suya. Se muestran
tal cual, sin modificarlas, y solo si tú lo pides.

### 2.2 · Entrar con Google

Si eliges entrar con Google, recibimos **tu dirección de correo, tu nombre y tu
foto de perfil de Google**. El correo es lo que identifica tu cuenta y lo que
permite recuperarla; no es público.

No pedimos acceso a tu Gmail, ni a tus contactos, ni a tu Drive, ni a ningún
otro servicio de Google. Puedes retirarnos el acceso cuando quieras desde la
configuración de seguridad de tu cuenta de Google.

### 2.3 · Spotify

Pedimos permiso para leer **tus listas, tus canciones más escuchadas y lo último
que has escuchado**. Guardamos únicamente los títulos, artistas y carátulas de
lo que hayas elegido enseñar en tu perfil.

**No guardamos tu historial completo de escucha**, ni podemos controlar tu
reproducción, ni ver tu correo o tu método de pago de Spotify.

### 2.4 · Desvincular

Puedes desvincular cualquiera de las dos desde tus ajustes. Al hacerlo se borra
de inmediato lo que habíamos guardado de esa cuenta. Puedes además revocar el
acceso desde Discord y desde Spotify directamente, y allí conviene hacerlo
también.

---

## 3. Cuánto tiempo

- **Mientras tengas la cuenta**, lo que has creado se conserva.
- **Al borrar la cuenta**, el perfil deja de ser accesible al instante y todo se
  elimina de nuestros sistemas en un plazo máximo de **30 días**, incluidas las
  imágenes y el vídeo.
- **Los datos de Discord y Spotify** se borran en cuanto desvinculas, sin esperar
  a los 30 días.
- **Las copias de seguridad** pueden conservar rastros hasta **30 días**
  más, por el propio funcionamiento del sistema de copias. Esas copias no se
  consultan ni se usan para nada salvo restaurar una avería.
- **Los contadores agregados** (número de visitas de un día) pueden sobrevivir
  sin vinculación a ninguna persona.

---

## 4. Con quién se comparte

Con nadie, salvo con la infraestructura necesaria para que esto funcione:

| Quién | Para qué |
|---|---|
| **Supabase** | Base de datos, cuentas y almacenamiento de imágenes |
| **Hostinger** | Guarda y sirve la página |
| **Cloudflare** | Reparte la página por el mundo y la defiende de ataques; guarda también los vídeos e imágenes de fondo |
| **Vimeo** | Los fondos de vídeo subidos antes de septiembre de 2026, que siguen alojados ahí |
| **YouTube** | Reproduce la música que eliges para tu perfil; recibe la petición de tu navegador al abrirlo |
| **Google Fonts** | Sirve las tipografías; recibe la petición de tu navegador |
| **Resend** | Envía los correos de tu cuenta —confirmar el registro, cambiar la contraseña o el correo—; recibe tu dirección y el texto de ese correo |
| **Tebex** | Cobra Premium como vendedor y comerciante registrado: recibe lo que pide su formulario de pago —correo, nombre, país y datos de pago— y nos dice solo el número de la compra y a qué perfil va. Solo si compras |
| Discord / Spotify | Solo si tú los vinculas, y solo para pedirles lo de arriba |

**No usamos analítica de terceros, ni Google Analytics, ni píxeles de redes
sociales, ni ninguna otra pieza que exista para seguirte.**

También lo entregaríamos si nos lo exige una autoridad competente por vía legal.

**No vendemos datos personales. No los cedemos a anunciantes. No hacemos
perfilado publicitario.**

---

## 4 bis. Con qué derecho tratamos tus datos

Donde la ley lo exige, estas son nuestras bases legales:

- **Para cumplir el contrato contigo:** prestar el servicio, mostrar tu perfil,
  mantener tu cuenta.
- **Por interés legítimo:** seguridad, prevención de fraude y abuso, estadísticas
  sin cookies, y mejorar el producto.
- **Con tu consentimiento:** vincular Discord o Spotify, y recibir correos que no
  sean imprescindibles.
- **Por obligación legal:** conservar lo que la ley nos exija y responder a
  requerimientos.

---

## 5. Tus derechos

Puedes pedirnos en cualquier momento:

- **ver** qué tenemos tuyo,
- **corregir** lo que esté mal,
- **borrar** tu cuenta y todo su contenido,
- **llevártelo** en un archivo que puedas leer,
- **oponerte** a un tratamiento concreto.

Escribe a **hello@sharee.fun**. Respondemos en un plazo máximo de **30
días**. Lo de ver, corregir y borrar puedes hacerlo tú mismo desde los ajustes,
sin escribir a nadie.

Si estás en la Unión Europea o en el Reino Unido, tienes además los derechos del
RGPD y puedes reclamar ante tu autoridad de protección de datos. Si estás en
Colombia, esta política se rige por la Ley 1581 de 2012 y puedes acudir a la
Superintendencia de Industria y Comercio.

---

## 6. Menores

sharee no está dirigido a menores de **13 años**, ni a quien no alcance **la
edad mínima que exija la ley de su país, si es mayor de 13**. No recogemos a
sabiendas datos de menores por debajo de esa edad.

Si detectamos una cuenta así, la eliminamos. Si eres madre, padre o tutor y crees
que un menor a tu cargo tiene una cuenta aquí, escribe a **hello@sharee.fun**
y la borramos.

---

## 7. Seguridad

- Las contraseñas se guardan cifradas y nadie puede leerlas, tampoco nosotros.
- Todo viaja cifrado (HTTPS).
- Cada cuenta solo puede escribir en lo suyo, y eso se comprueba **en el
  servidor**, no solo en el navegador.
- Ningún sistema es infalible. Si hubiera una brecha que te afecte, te lo
  diremos por correo y lo publicaremos aquí.

---

## 8. Contenido de otros y denuncias

Los perfiles los escriben sus dueños; no revisamos cada uno antes de publicarlo.
Si ves un perfil que suplanta a alguien, publica datos de otra persona, o
contiene material ilegal, denúncialo desde el propio perfil o escribe a
**hello@sharee.fun**. Lo revisamos y, si procede, lo retiramos.

---

## 9. Cambios

Si cambiamos algo importante, lo avisaremos en la página y por correo antes de
que entre en vigor. La fecha de arriba dice cuándo se actualizó por última vez.

---

## 10. Documentos relacionados

- [Términos del servicio](/terminos) — las reglas del sitio, qué se
  puede publicar y qué pasa si no.
- [Política de derechos de autor y DMCA](/copyright) — cómo denunciar
  una infracción y cómo responder si te retiran algo.

---

**Contacto:** **hello@sharee.fun**
