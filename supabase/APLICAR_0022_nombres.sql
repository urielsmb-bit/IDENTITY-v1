-- ============================================================
-- sharee · 0022 · los nombres que ya no puede coger nadie
--
-- La direccion de un perfil pasa a ser `sharee.fun/<usuario>`, sin el `/u/`
-- de antes. Eso mete a los perfiles y a las paginas de la aplicacion en el
-- MISMO espacio de nombres, y ahi la lista de reservados deja de ser una
-- precaucion contra la suplantacion y pasa a ser lo que impide una colision.
--
-- Cuatro rutas de hoy no estaban en la lista. Con la forma antigua daba
-- igual —un perfil vivia en `/u/entrar` y la pagina en `/entrar`, sin
-- estorbarse— pero ahora quien se registrara como `entrar` se quedaria con
-- un perfil al que no se puede llegar: la ruta gana, y su pagina no abre
-- nunca. No es un fallo que se pueda arreglar despues sin quitarle el
-- nombre a alguien.
--
-- La lista vive en TRES sitios y los tres tienen que decir lo mismo:
--   · aqui, que impide registrarse con ese nombre;
--   · `react/vercel.json`, que decide que direcciones van a la funcion;
--   · `react/hostinger/.htaccess`, lo mismo para el hosting compartido.
-- Si se añade una ruta a la aplicacion, se añade en los tres.
--
-- Aplicar: pegar en el editor SQL. Se puede relanzar.
-- ============================================================

insert into nombres_reservados (nombre, motivo) values
  -- rutas que ya existian y no estaban apuntadas
  ('entrar','ruta'), ('top','ruta'), ('probar','ruta'), ('u','ruta'),

  -- la marca nueva, por lo mismo que estaba la vieja: que nadie se haga
  -- pasar por la casa. `identity` se queda reservado tambien -era el
  -- nombre de antes y sigue llevando a la misma gente-.
  ('sharee','marca'), ('share','marca'), ('sharee-fun','marca')
on conflict (nombre) do nothing;


-- ---- comprobar -------------------------------------------------
select nombre, motivo
  from nombres_reservados
 where nombre in ('entrar','top','probar','u','sharee','identity')
 order by nombre;
