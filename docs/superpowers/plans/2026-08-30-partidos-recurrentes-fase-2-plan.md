# Plan de implementacion - Partidos recurrentes Fase 2

## Criterio de terminado

La fase queda lista para validacion en dispositivo cuando un capitan puede crear una recurrencia semanal o mensual desde el formulario normal del equipo, los miembros ven y confirman cada instancia privada, el capitan puede anular la regla sin alterar el partido vigente y la publicacion de plazas obliga a elegir entrada directa o revision. La base de datos debe mantener una unica instancia futura por regla, conservar la hora local de `Europe/Madrid` en marzo y octubre y no exponer reglas ni partidos privados a usuarios ajenos.

## Lote 1 - Base de datos sin cron

1. Crear `team_match_recurrences` con frecuencia, calendario, plantilla inmutable, estado y referencia al primer partido.
2. Anadir `matches.recurrence_id`, su clave foranea y la unicidad `(recurrence_id, date_time)`.
3. Proteger la tabla con RLS de solo lectura para capitan y miembros activos; no permitir escrituras directas del cliente.
4. Anadir helpers privados para calcular la siguiente ocurrencia local y generar instancias de forma idempotente.
5. Sustituir `create_team_match(...)` por la firma atomica que crea partido, regla opcional y participantes `pending`.
6. Anadir `cancel_team_match_recurrence(uuid)` con autorizacion de capitan y bloqueo de fila.
7. Sustituir `publish_team_match(uuid)` por `publish_team_match(uuid, boolean)` para fijar la aprobacion al publicar.
8. Mantener intactos `auto_confirm_attendance()` y la logica de fiabilidad.

Verificacion: migracion local reproducible, pruebas SQL semanales/mensuales, DST de marzo y octubre, idempotencia, anulacion, permisos cruzados y privacidad en `partidos_cerca`.

## Lote 2 - Formulario de partido del equipo

1. Retirar `Requiere aprobacion` solo cuando existe `teamId`.
2. Anadir el control `Crear partido recurrente` y los selectores semanal/mensual.
3. Mostrar semana del mes solo para mensual: primera, segunda, tercera, cuarta o ultima.
4. Sincronizar la primera fecha con el dia elegido conservando la hora.
5. Enviar los parametros de recurrencia a `create_team_match(...)` y mantener el flujo no recurrente.
6. Centrar el texto de `Crear partido privado` y conservar estados de carga y bloqueo.

Verificacion: `npx tsc --noEmit` y `npm run lint` tras cada cambio logico; prueba manual de ambos calendarios y reintento con error.

## Lote 3 - Ficha del equipo y publicacion

1. Cargar las recurrencias bajo RLS junto con su siguiente partido.
2. Mostrar `Partidos recurrentes` bajo la plantilla y antes de la gestion.
3. Permitir al capitan anular con una confirmacion que nombre la instancia que sigue vigente.
4. Reforzar visualmente `Crear partido` con borde verde de 2 puntos y fondo verde suave.
5. Sustituir la alerta de publicacion por una eleccion obligatoria entre entrada directa y revision de solicitudes.
6. Enviar esa eleccion a `publish_team_match(...)` y recargar el partido.

Verificacion: `npx tsc --noEmit`, `npm run lint`, accesibilidad tactil y comprobacion con capitan, miembro y usuario ajeno.

## Lote 4 - Cron y cierre

1. Ejecutar el generador manualmente con tiempos controlados y confirmar una sola instancia futura.
2. Ejecutar pruebas de marzo, octubre, meses cortos, bisiesto, ultima semana y dos reglas independientes.
3. Ejecutar asesores de seguridad y rendimiento de Supabase.
4. Presentar por separado el SQL exacto de `cron.schedule` y esperar aprobacion.
5. Tras aprobarlo, programar un job diario que invoque la funcion interna como `postgres`.
6. Completar el checklist en dispositivo real antes de cerrar la fase.

## Limites del lote

- No hay edicion de reglas; se anulan y se crean de nuevo.
- No hay fecha final, numero de partidos, publicacion automatica ni pushes nuevos.
- Cancelar un partido no adelanta la siguiente generacion.
- Anular una recurrencia no modifica partidos ya creados.
- `.superpowers/` no se versiona; solo se versionan estos documentos bajo `docs/superpowers/`.
