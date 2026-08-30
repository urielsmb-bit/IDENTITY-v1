-- ============================================================
-- IDENTITY · limpiar las denuncias de la auditoría
--
-- Al comprobar F3-01 hubo que INSERTAR denuncias de verdad: era la
-- única forma de saber si el `autor_id` falso se descartaba, porque
-- la tabla —correctamente— no se puede leer desde el navegador.
--
-- Son tres filas con `detalle` que empieza por "sonda". Esto las
-- borra. Ejecútalo cuando quieras; no hay prisa ni riesgo.
-- ============================================================

select count(*) as sondas_encontradas
  from denuncias
 where detalle like 'sonda%';

delete from denuncias
 where detalle like 'sonda%';

-- Comprobación: debe quedar en 0
select count(*) as sondas_restantes
  from denuncias
 where detalle like 'sonda%';
