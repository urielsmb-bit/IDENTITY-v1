-- ============================================================
-- sharee · 0024 · una politica que no podia hacer nada
--
-- En la 0023 le puse a `insignias_catalogo` una politica de lectura
-- abierta:
--
--     create policy catalogo_lectura on public.insignias_catalogo
--       for select using (true);
--
-- Y no sirve para nada, porque RLS no concede: FILTRA. Primero tiene que
-- existir un `grant select` a nivel de tabla, y solo entonces la politica
-- decide que filas se ven. Las tablas que crea Supabase desde su panel
-- salen con ese grant puesto; una tabla creada con SQL en una migracion,
-- no. Asi que la politica decia «pasa cualquiera» sobre una puerta que
-- estaba cerrada con llave un piso mas abajo.
--
-- Comprobado contra produccion despues de aplicar la 0023:
--
--     GET /rest/v1/insignias_catalogo?select=id
--     42501 · permission denied for table insignias_catalogo
--
-- No rompio nada, y eso es lo que la hacia facil de no ver: el catalogo
-- no lo lee el navegador. La llave foranea lo comprueba dentro de la base,
-- y `conceder_insignia()` tambien, las dos corriendo como dueñas de la
-- tabla, donde ni los grants ni RLS les aplican. El unico daño era dejar
-- escrita en el esquema una afirmacion falsa.
--
-- Se quita la politica en vez de anadir el grant. Nadie lo lee desde
-- fuera, y lo que no se lee no se abre: sin politicas, RLS lo niega todo
-- —el mismo trato que `privado.config` desde la 0001—.
--
-- Si algun dia el panel quiere leerlo —para avisar de que el catalogo del
-- navegador y el de la base se han desincronizado, que es el unico uso que
-- se me ocurre— hacen falta las dos lineas, no una:
--
--     grant select on public.insignias_catalogo to anon, authenticated;
--     create policy catalogo_lectura on public.insignias_catalogo
--       for select using (true);
--
-- Aplicar:  supabase db push   (o pegar en el editor SQL)
-- ============================================================

drop policy if exists catalogo_lectura on public.insignias_catalogo;

comment on table public.insignias_catalogo is
  'Los identificadores validos. No se lee desde fuera: lo usan la llave foranea y las funciones que conceden, que corren como dueñas. Sin politicas, RLS lo niega todo.';
