# Habilidades de este proyecto

Aquí viven las *skills* que Claude Code carga solo, sin que haya que
pedírselas: cuando una tarea encaja con la descripción de una, se lee.

## De dónde salen estas dos

No son nuestras. Están **copiadas** de un repositorio de Supabase, y por eso
conviene saber de cuál y de cuándo:

| | |
|---|---|
| Origen | <https://github.com/supabase/agent-skills> |
| Commit | `8331f910845103c08d51f6ca1d86ebb7d1f745e3` |
| Copiadas | 10 de septiembre de 2026 |
| Licencia | MIT — el texto está en `LICENSE-supabase-agent-skills` |

- **`supabase/`** (v0.1.2) — cómo trabajar con Supabase: la CLI, las
  migraciones, la lista de trampas de seguridad, cómo depurar un error de
  PostgREST o de RLS.
- **`supabase-postgres-best-practices/`** (v1.1.1) — reglas de Postgres:
  índices, tipos de columna, bloqueos, conexiones, RLS y su coste.

Se copian y no se enlazan a propósito: así el proyecto no depende de que un
repositorio de otro siga en su sitio, y actualizarlas es una decisión que se
toma y se revisa, no algo que pase solo un martes.

**Para actualizarlas**, vuelve a bajar el repositorio de arriba y sustituye
las dos carpetas enteras. Cada una trae su `CHANGELOG.md`, así que se puede
ver qué cambió antes de aceptarlo. Actualiza también el commit de esta tabla.

## Una advertencia importante sobre este proyecto

La skill de Supabase dice, con toda la razón en general:

> **Views bypass RLS by default.** In Postgres 15 and above, use
> `CREATE VIEW ... WITH (security_invoker = true)`.

**Aquí eso rompería el sitio público, y no es una opinión: está comprobado.**

`perfiles` no es legible en público — su única política de lectura es
`dueno = auth.uid()`. Lo que ve un visitante sale exclusivamente de cuatro
vistas: `perfiles_publicos`, `descubrir`, `insignias_de_perfil` y
`cifras_publicas`. Corren con los permisos de su dueño **a propósito**: la
vista *es* el control de acceso, y solo proyecta columnas seguras de perfiles
activos. Que un dato no aparezca ahí es la garantía de que no sale.

Con `security_invoker = true` las cuatro devuelven cero filas para cualquiera
que no sea el dueño: sin perfiles, sin Descubrir, sin insignias, sin cifras en
la portada.

Ya pasó una vez. La migración 0008 rehizo `descubrir` partiendo de una
definición vieja y le devolvió `security_invoker = true` sin querer; Descubrir
se quedó vacío para todo el mundo, y la migración 0009 existe para arreglar
exactamente eso. Está contado en su cabecera.

Por eso el *Advisor* de Supabase marca cuatro avisos «Security Definer View»
en este proyecto. Son conocidos y aceptados, no deuda pendiente.
