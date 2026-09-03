# IDENTITY — desplegar

Dos partes, y son independientes: **la base de datos** y **las funciones de
borde**. Se pueden hacer en cualquier orden.

---

# A · La base de datos

## Por el editor SQL, no por el CLI

`supabase db push` mira una tabla del servidor para saber qué migraciones
están aplicadas. Si las primeras se aplicaron pegando `APLICAR.sql` en el
editor —que es como se hizo aquí—, esa tabla **está vacía**, y `db push`
intentaría aplicarlas todas desde cero. Los archivos aguantan volver a
lanzarse, pero «aguanta» no es motivo para arriesgar una base de datos con
gente dentro.

Así que: pegar. Es además lo que ya sabes hacer.

1. `supabase.com/dashboard` → tu proyecto → **SQL Editor** → *New query*
2. Pega **`supabase/APLICAR_0007_0008.sql`** entero y dale a *Run*
3. Pega **`supabase/VERIFICAR.sql`** y comprueba que no se queja

`APLICAR_0007_0008.sql` trae sólo lo nuevo: las insignias que no se puede
poner uno mismo, y que «Perfil público» apagado esconda de verdad. Se puede
relanzar sin romper nada.

> **Un paso borra datos.** El punto 4 de la 0007 quita la clave `badges` de
> `perfiles.apariencia` en todas las filas — son las insignias que cada cual
> se había puesto a sí mismo. Es a propósito. Si quieres una copia antes, el
> propio archivo trae la consulta arriba.

---

# B · Las funciones de borde

Tres funciones, y **una variable de la que depende que el ranking no se pueda
comprar**.

## 1 · El CLI y enlazar el proyecto

No hace falta instalarlo: `npx` lo baja solo. (Supabase **no** soporta
`npm i -g supabase`.)

```bash
cd C:/Users/uriel/Desktop/c
npx supabase login
npx supabase link --project-ref ypvipmhfnraalcqbttiq
```

`login` abre el navegador. `link` pide la contraseña de la base de datos —la
que pusiste al crear el proyecto; si no la recuerdas se cambia en
*Settings → Database → Reset database password*.

## 2 · ⚠️ La variable, ANTES de desplegar

```bash
npx supabase secrets set ORIGENES_PERMITIDOS="https://TU-APP.vercel.app,http://localhost:5199,http://localhost:8765"
```

`5199` es el servidor de desarrollo de React; `8765` el de la app original.
Deja los dos si sigues usando ambos.

Separados por comas, **sin barra final**, y el esquema tiene que coincidir
exactamente: `https://x` y `http://x` son orígenes distintos.

**Por qué importa tanto.** `registrar-vista` cuenta una visita única por cada IP
distinta. Con CORS abierto, cualquiera podía poner un `<script>` escondido en
una web con tráfico y **cada visitante de esa web sumaba una visita única** al
perfil que quisiera. Únicas de verdad, porque son IPs reales de personas
distintas. Y las visitas únicas son las que ordenan Descubrir.

O sea: el puesto en el ranking se compraba con un iframe.

Si esta variable no está puesta, las funciones **fallan hacia cerrado**: no
permiten ningún origen y avisan en el registro. Es a propósito. Antes el valor
por defecto era `*`, y olvidar una variable abría la puerta en vez de cerrarla.

Y la de Vimeo, sólo si vas a usar fondos de vídeo:

```bash
npx supabase secrets set VIMEO_TOKEN="tu-token-de-vimeo"
npx supabase secrets set VIMEO_DOMINIOS="TU-APP.vercel.app,localhost"
```

El token sale de `developer.vimeo.com` → *My Apps* → tu app → *Authentication*,
con permisos de subida. **Sólo vive aquí**: nunca en el navegador, porque
quien lo tenga puede subir a tu cuenta.

## 3 · Desplegar

```bash
npx supabase functions deploy registrar-vista
npx supabase functions deploy borrar-cuenta
npx supabase functions deploy vimeo-subida
```

La carpeta `_compartido/` **no se despliega como función** —el guion bajo lo
indica— pero su código viaja con las dos que lo importan.

## 4 · Comprobar

```bash
npx supabase functions list
```

Y desde la aplicación: visita un perfil y mira si el contador sube. Si no sube,
mira el registro:

El CLI **no tiene** `functions logs`. Los registros estan en el panel:
`supabase.com/dashboard` -> tu proyecto -> **Edge Functions** -> la funcion
-> pestana **Logs**.

Y si lo que no cuadra son las visitas, hay un diagnostico que mira por
dentro: pega `supabase/DIAGNOSTICO_VISTAS.sql` en el editor SQL. La funcion
devuelve 204 tanto si conto como si fallo —a proposito, para no revelar si
un perfil existe— asi que desde fuera no se puede saber.

Si aparece `ORIGENES_PERMITIDOS sin configurar`, es el paso 2.

## Variables que usan las funciones

| Variable | Quién la pone | Para qué |
|---|---|---|
| `SUPABASE_URL` | Supabase, sola | — |
| `SUPABASE_ANON_KEY` | Supabase, sola | Comprobar de quién es un token |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase, sola | Borrar cuentas y contar visitas |
| `ORIGENES_PERMITIDOS` | **Tú** | La lista blanca de CORS |
| `BUCKET_MEDIA` | Tú, opcional | Nombre del cubo (por defecto `media`) |
| `VIMEO_TOKEN` | **Tú** | Subir fondos de vídeo a Vimeo |
| `VIMEO_DOMINIOS` | Tú, opcional | Dónde se puede incrustar el vídeo |

**La clave de servicio la inyecta Supabase en las funciones y no aparece en
ningún archivo del repositorio.** Nunca la copies a `js/config.js`.
