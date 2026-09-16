# R2 · cómo se monta

Los vídeos de fondo nuevos pasan a guardarse en Cloudflare R2 en vez de en
Vimeo. Esto es lo que hay que hacer **una vez**, en el navegador. El código
ya está.

**Nada de lo que ya está subido se toca.** Los seis perfiles con fondo en
Vimeo siguen en Vimeo y se siguen viendo igual; los vídeos que estén en el
cubo de Supabase siguen ahí. Esto solo decide a dónde van los nuevos.

---

## 1 · Crear el cubo

Cloudflare → **R2 Object Storage** → *Create bucket*.

- Nombre: `sharee`
- Location: *Automatic*
- Default Storage Class: **Standard**

`Standard` y no `Infrequent Access`: la segunda cobra por RECUPERAR los
datos, que es exactamente lo que hace falta que sea gratis aquí, y además
el regalo de los 10 GB no se aplica a esa clase.

## 2 · Que se pueda leer desde fuera

Cubo → **Settings** → **Custom Domains** → *Add*

- Dominio: `cdn.sharee.fun`
- *Continue* → te enseña el registro DNS que va a crear → **Connect Domain**

`sharee.fun` tiene que estar como zona en ESTA misma cuenta de Cloudflare.
Si lo está, el DNS se pone solo.

> En la misma pantalla hay otra sección, **Public Development URL**, con un
> botón *Enable*. **Esa no.** Es la dirección `r2.dev`, y con ella no hay
> caché, ni WAF, ni control de acceso — o sea, nada de lo que hace que esto
> salga gratis y rápido. Cloudflare dice que no es para producción.

Con dominio propio la caché del borde se pone delante —es lo que hace
bandi.lol: 17 días sin tocar el origen— y el archivo se sirve desde el país
de quien mira, sin coste de salida.

## 3 · Permitir que el navegador escriba

Cubo → **Settings** → *CORS Policy* → **Add CORS policy** → pestaña JSON:

```json
[
  {
    "AllowedOrigins": [
      "https://sharee.fun",
      "http://localhost:5199",
      "http://localhost:5200"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "Cache-Control"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 86400
  }
]
```

Sin esto la subida falla aunque el permiso sea correcto: el navegador ni
llega a intentarlo.

Los dos `localhost` son para poder probarlo aquí antes de publicar. Si te
molesta tenerlos, quítalos cuando esté funcionando.

## 4 · Las llaves

Pantalla principal de **R2 Object Storage** → columna derecha, panel
**Account Details** → al lado de *API Tokens*, el enlace **Manage** → *Create
API token*.

- Permissions: **Object Read and Write**
- Specify bucket(s): solo `sharee`
- Y abajo: **Create Account API token** (no *User API token*)

> OJO: no es la pantalla de *Account API tokens → Create a token*, la que
> ofrece «Read all resources» y «Edit zone DNS». Esa crea un token general
> de Cloudflare, de los de `Bearer`, y no sirve: R2 necesita credenciales
> de S3 (un Access Key ID y un Secret Access Key), y solo salen por el
> camino de arriba.

De cuenta y no de usuario: el de usuario va atado a tu persona y muere con
ella; este es una integracion de servidor y tiene que sobrevivir a que
cambies de cuenta. «No expiration» por lo mismo — un token que caduca a los
90 dias hace que las subidas dejen de funcionar un martes cualquiera sin
que nadie lo relacione.

Al crearlo te enseña **Access Key ID** y **Secret Access Key** (Cloudflare
los llama a veces *Client ID* y *Client Secret*). El secreto se ve **una
sola vez**: si cierras esa pantalla sin copiarlo, hay que crear otro token.

> No me los pegues aquí. Van directos de esa pantalla a la siguiente.

Necesitas también el **Account ID**, que sale en la columna derecha de la
página de R2 (*Account Details*).

## 5 · Guardarlas donde el navegador no las vea

Supabase → **Edge Functions** → *Secrets*:

| nombre | valor |
|---|---|
| `R2_CUENTA` | el Account ID: los 32 caracteres del campo **S3 API** del cubo, entre `https://` y `.r2.cloudflarestorage.com`. Vale pegar ese campo entero, la función se queda con lo que necesita |
| `R2_CUBO` | `sharee` |
| `R2_CLAVE_ID` | el Access Key ID |
| `R2_CLAVE_SECRETA` | el Secret Access Key |
| `R2_PUBLICO` | `https://cdn.sharee.fun` |

Estas claves dan permiso de **escritura y borrado** sobre el cubo. Por eso
viven aquí y no en el sitio: cualquiera que abra las herramientas del
navegador vería lo que hay en el paquete. El navegador solo recibe un
permiso firmado para **un** archivo, de **un** tamaño, de **un** tipo, y
durante diez minutos.

## 6 · Publicar la función

```bash
supabase functions deploy r2-subida
```

## 7 · Encender el interruptor

`VITE_R2=1` donde se construye el sitio (el mismo sitio donde está
`VITE_SUPABASE_URL`) y volver a desplegar.

Sin esa variable no cambia nada: los vídeos siguen yendo a Vimeo. Con
ella, los nuevos van a R2.

---

## Comprobar que ha entrado

1. Editor → cambiar el fondo por un vídeo → subirlo.
2. Abrir el perfil y mirar el fondo: tiene que ser un `<video>`, no un
   `<iframe>`.
3. La dirección guardada empieza por `https://cdn.sharee.fun/fondos/`.

Si falla, el aviso del editor dice cuál de los cinco secretos falta: la
función responde con el nombre en vez de un 500 mudo.

---

## Lo que cuesta

| | gratis al mes |
|---|---|
| Almacenamiento | 10 GB |
| Escrituras (subir) | 1.000.000 |
| Lecturas (ver un perfil) | 10.000.000 |
| **Salida de datos** | **sin límite, no se cobra** |

A 8 MB por vídeo, 10 GB son unos 1.250 fondos. Hay 6.

Lo que de verdad vale de R2 es la última fila: la salida es lo que en
cualquier otro sitio se paga, y es lo que escala con las visitas.
