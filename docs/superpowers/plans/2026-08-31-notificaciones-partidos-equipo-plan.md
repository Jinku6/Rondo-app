# Plan de implementacion - Notificaciones de partidos de equipo

## Criterio de terminado

La funcionalidad queda lista para validacion en dispositivo cuando el capitan forma parte real de la plantilla, puede confirmar su asistencia y los cinco avisos aprobados seleccionan exactamente a sus destinatarios sin duplicarse. Los partidos privados confirmados deben conservar baja, recordatorio ordinario, cancelacion, finalizacion, asistencia y valoraciones. Ningun cambio de base de datos se aplicara en produccion antes de mostrar el SQL exacto y recibir aprobacion.

## Lote 1 - Eventos push inmediatos

1. Ampliar `PushType` con `team_match_created`, `team_attendance_reminder`, `team_match_published` y `team_publish_prompt`.
2. Cargar en `send-push` el contexto de equipo necesario: `series_id`, privacidad, publicacion y nombre del equipo.
3. Distinguir una reserva privada `pending` de una solicitud publica: la primera avisa al propio miembro y la segunda conserva el aviso actual al capitan.
4. Ampliar la insercion de `notifications` para procesar el marcador interno `team_match_published` y avisar al usuario de la fila.
5. Mantener las eliminaciones de participantes sin cambios, evitando confundir bajas, expulsiones o solicitudes retiradas con una publicacion.
6. Aplicar el copy de plantilla completa solo a partidos de equipo y mantener intacto el copy publico.
7. Anadir pruebas de contrato para destinatarios, copys, rutas y claves de deduplicacion.

Verificacion: ejecutar la prueba nueva, `npx expo lint` y `npx tsc --noEmit`.

## Lote 2 - Avisos programados

1. Mantener el tipo de cron `match_reminders` y su frecuencia actual.
2. Conservar sin cambios el recordatorio ordinario de 30 minutos para `joined` y `approved`.
3. Consultar partidos privados de equipo en la ventana de 48 horas y avisar solo a `pending` cuando el partido siga `open` y con plazas.
4. Consultar partidos privados de equipo en la ventana de 24 horas y avisar solo al capitan cuando siga incompleto y no publicado.
5. Usar el nombre del equipo en los copys y claves estables por tipo, partido y usuario.
6. Anadir pruebas de ventanas, filtros de estado, copys y deduplicacion.

Verificacion: ejecutar la prueba nueva, `npx expo lint` y `npx tsc --noEmit`.

## Lote 3 - Invariante del capitan

1. Consultar `supabase migration --help` y crear la migracion con Supabase CLI.
2. Crear una funcion trigger privada, `SECURITY DEFINER` y con `search_path` fijo que inserte al organizador como miembro activo despues de crear un equipo.
3. Revocar la ejecucion directa de la funcion a roles de cliente.
4. Sanear de forma idempotente los equipos activos existentes.
5. Sanear partidos futuros, privados y no publicados que no tengan participacion del capitan, insertandolo como `pending`.
6. Sustituir `publish_team_match(uuid)` para insertar, antes de liberar reservas, un marcador `notifications.type = 'team_match_published'` con `read = true` por cada miembro `pending`.
7. Mantener el overload `publish_team_match(uuid, boolean)` delegando en la funcion corregida.
8. No tocar equipos eliminados ni partidos publicos, pasados, cancelados o completados.
9. Anadir pruebas de contrato para trigger, seguridad, saneamiento, publicacion idempotente y compatibilidad con `get_public_team`.

Verificacion: revisar el SQL completo, ejecutar tests y confirmar con consultas de solo lectura que el SQL propuesto cubre exactamente los dos invariantes observados.

## Lote 4 - Validacion y commits

1. Ejecutar `npx expo lint`.
2. Ejecutar `npx tsc --noEmit`.
3. Ejecutar `npm test`.
4. Ejecutar `git diff --check` y revisar el diff archivo por archivo.
5. Crear un commit para Edge Functions y pruebas.
6. Crear un commit separado para la migracion y sus pruebas si el diff queda mas claro asi.

Verificacion: worktree limpio, commits logicos y ninguna modificacion de produccion.

## Lote 5 - Aprobacion y produccion

1. Mostrar al usuario el archivo SQL completo y explicar datos afectados, reversibilidad y consultas de comprobacion.
2. Esperar confirmacion explicita.
3. Desplegar `send-push` y `scheduled-pushes` antes de insertar participaciones saneadas.
4. Aplicar la migracion aprobada.
5. Ejecutar advisors de seguridad y rendimiento.
6. Verificar versiones activas, cero capitanes ausentes y cero partidos privados futuros sin capitan.
7. Revisar logs sin exponer tokens ni datos personales.

Verificacion: backend desplegado y comprobado. La recepcion, el copy y la navegacion quedan pendientes de la prueba final con instalaciones reales.

## Limites

- No hay publicacion automatica.
- No se avisa a `declined` al publicar.
- No se anade otro cron ni una cola nueva.
- No se cambian pagos, ventanas de cancelacion, asistencia, fiabilidad o valoraciones.
- No se modifica la UI ni los avisos ordinarios salvo el copy de `match_full` para partidos de equipo.
