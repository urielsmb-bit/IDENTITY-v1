# IDENTITY — desplegar las funciones de borde

Dos funciones, y **una variable de entorno de la que depende que el ranking no
se pueda comprar**.

## 1 · Instalar el CLI y enlazar el proyecto

```bash
npm i -g supabase
supabase login
supabase link --project-ref ypvipmhfnraalcqbttiq
```

## 2 · ⚠️ La variable, ANTES de desplegar

```bash
supabase secrets set ORIGENES_PERMITIDOS="https://TU-APP.vercel.app,http://localhost:8765"
```

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

## 3 · Desplegar

```bash
supabase functions deploy registrar-vista
supabase functions deploy borrar-cuenta
```

La carpeta `_compartido/` **no se despliega como función** —el guion bajo lo
indica— pero su código viaja con las dos que lo importan.

## 4 · Comprobar

```bash
supabase functions list
```

Y desde la aplicación: visita un perfil y mira si el contador sube. Si no sube,
mira el registro:

```bash
supabase functions logs registrar-vista
```

Si aparece `ORIGENES_PERMITIDOS sin configurar`, es el paso 2.

## Variables que usan las funciones

| Variable | Quién la pone | Para qué |
|---|---|---|
| `SUPABASE_URL` | Supabase, sola | — |
| `SUPABASE_ANON_KEY` | Supabase, sola | Comprobar de quién es un token |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase, sola | Borrar cuentas y contar visitas |
| `ORIGENES_PERMITIDOS` | **Tú** | La lista blanca de CORS |
| `BUCKET_MEDIA` | Tú, opcional | Nombre del cubo (por defecto `media`) |

**La clave de servicio la inyecta Supabase en las funciones y no aparece en
ningún archivo del repositorio.** Nunca la copies a `js/config.js`.
