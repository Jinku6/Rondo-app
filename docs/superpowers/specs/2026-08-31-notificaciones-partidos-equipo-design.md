# Notificaciones de partidos de equipo

## Objetivo

Completar las notificaciones push del ciclo privado de los partidos de equipo sin crear una segunda infraestructura de avisos ni alterar el comportamiento ordinario de los partidos de Rondo.

La plantilla recibirá avisos para conocer un partido nuevo, confirmar asistencia y saber cuándo se abren plazas al público. El capitán recibirá además un aviso cuando se complete la plantilla y una sugerencia manual de publicación si siguen quedando plazas 24 horas antes.

El alcance incluye corregir un defecto confirmado en producción: el capitán aparece visualmente en la plantilla, pero no existe como miembro activo ni como participante del partido. Por ello, actualmente no puede confirmar su propia asistencia.

## Estado verificado

- El cliente registra Expo Push Tokens y abre las rutas incluidas en una notificación.
- `send-push` procesa los webhooks de cambios inmediatos y `scheduled-pushes` procesa avisos temporales.
- `push_notification_log.dedupe_key` evita duplicados.
- El job `push-match-reminders` está activo y se ejecuta cada cinco minutos.
- Los partidos privados se crean con los miembros activos en `match_participants.status = 'pending'`.
- `publish_team_match` elimina las participaciones `pending` y `declined`, conserva las confirmadas y activa `recruiting_public`.
- El aviso `match_full` al organizador ya existe para la transición `open` a `full`.
- La finalización automática, las valoraciones, el recordatorio de 30 minutos, la baja de un jugador confirmado y los avisos por cancelación dependen de los estados del partido y del participante, no de su privacidad.
- En producción existen dos equipos y ambos carecen de una fila activa del capitán en `series_members`.
- El partido privado futuro y no publicado existente tampoco contiene al capitán en `match_participants`. Tiene capacidad para siete jugadores y ninguna participación actual, por lo que puede sanearse sin sobreaforo.
- `get_public_team` construye la plantilla añadiendo primero al capitán desde `match_series.organizer_id` y después concatena los miembros activos, excluyendo expresamente al capitán. Añadir su membresía real no lo duplicará en la interfaz.

## Decisiones de producto

- Toda la plantilla activa recibe el aviso de un partido nuevo, incluido el capitán.
- El capitán debe confirmar su propia asistencia igual que cualquier otro jugador.
- El recordatorio de 48 horas se envía únicamente a participantes que sigan `pending`.
- Al publicar el partido se avisa únicamente a quienes seguían `pending`; los miembros `declined` no reciben ese aviso.
- La sugerencia de publicación a 24 horas es solo informativa. El partido nunca se publica automáticamente.
- El capitán no puede abandonar el equipo ni autoexpulsarse, pero conserva la capacidad actual de eliminarlo.
- Una vez que un participante confirma y pasa a `joined`, el partido privado conserva el mismo ciclo que uno público: baja, recordatorios ordinarios, cancelación, finalización automática, asistencia y valoraciones.
- No se modifica `auto_confirm_attendance()` ni el criterio de fiabilidad basado en `attended IS NOT NULL`.

Los textos entre corchetes de los copys son sustituciones en tiempo de ejecución: `[Equipo]` usa el nombre del equipo, `[Partido]` usa el título del partido y `[id]` usa su identificador de navegación. No representan decisiones pendientes.

## Enfoque elegido

Se reutilizarán los dos canales existentes:

- `send-push` para eventos inmediatos producidos por webhooks de base de datos.
- `scheduled-pushes` para los avisos de 48 y 24 horas, aprovechando el cron activo de cinco minutos.

No se añadirá una cola nueva, otro job ni programación local desde el dispositivo. Las notificaciones locales no serían fiables con la aplicación cerrada o tras un cambio de dispositivo, mientras que una cola adicional sería complejidad innecesaria para estos cinco casos.

## Invariante del capitán

Una migración garantizará que el organizador de cada equipo tenga también una fila activa en `series_members`.

### Equipos nuevos

Un trigger privado `AFTER INSERT` sobre `match_series` insertará al organizador como miembro activo dentro de la misma transacción. La función del trigger será `SECURITY DEFINER`, tendrá `search_path` fijo y no estará disponible para invocación directa desde roles de cliente.

La creación actual del equipo puede seguir usando la inserción autenticada existente. Si no se pudiera crear la membresía del capitán, la inserción completa del equipo se revertiría.

### Datos existentes

La misma migración realizará dos saneamientos idempotentes:

1. Añadir o reactivar al capitán en los equipos activos existentes.
2. Añadirlo con `status = 'pending'` a partidos futuros de equipo que continúen privados, no publicados y sin una participación suya.

No se modificarán equipos eliminados ni partidos públicos, cancelados, completados o pasados. El saneamiento utilizará las restricciones únicas existentes para poder reejecutarse sin duplicados.

### Compatibilidad con la plantilla y el borrado

`get_public_team` seguirá mostrando al capitán una sola vez porque ya excluye `series_members.user_id = organizer_id` al concatenar el resto de la plantilla.

No se añadirá ningún bloqueo sobre la eliminación del equipo. El flujo actual del capitán para eliminarlo seguirá siendo válido y las relaciones conservarán el comportamiento de borrado o archivado ya definido.

Los dos creadores de partidos, manual y recurrente, ya copian a todos los miembros activos. Después de corregir el invariante incluirán al capitán como `pending` sin necesitar lógica duplicada.

## Matriz de notificaciones

### 1. Nuevo partido de equipo

El webhook existente de inserción en `match_participants` distinguirá entre dos contextos:

- Partido privado de equipo todavía no publicado: enviará el aviso al propio participante `pending`.
- Solicitud de entrada pública: conservará el aviso existente al organizador.

Esto corrige el comportamiento actual, que interpreta todas las inserciones `pending` como solicitudes públicas y avisa incorrectamente al capitán.

Destinatarios: toda la plantilla añadida como `pending`, incluido el capitán.

Título: `Nuevo partido con [Equipo]`

Cuerpo: `Confirma tu asistencia.`

Ruta: `/match/[id]`

Clave de deduplicación: partido, participante y tipo `team_match_created`.

### 2. Recordatorio de asistencia a 48 horas

El job existente consultará partidos dentro de una ventana alrededor de las 48 horas y enviará el aviso solo cuando se cumplan todas estas condiciones:

- Pertenece a un equipo.
- Sigue siendo privado y `recruiting_public = false`.
- Continúa `open` y conserva plazas disponibles.
- El destinatario sigue `pending` al ejecutar el job.

Un miembro `joined`, `approved`, `declined`, `dropped` o eliminado no recibirá el recordatorio. Tampoco se enviará para partidos públicos, completos, cancelados o completados.

Título: `¿Juegas este partido?`

Cuerpo: `Quedan 48 h para [Partido] con [Equipo]. ¿Vas a ir?`

Ruta: `/match/[id]`

Clave de deduplicación: partido, participante y tipo `team_attendance_reminder`.

### 3. Partido abierto a Rondo

`publish_team_match` elimina `pending` y `declined` antes de activar `recruiting_public`. El webhook de eliminación ya recibe el estado anterior del participante y se ejecuta de forma asíncrona después del commit. Se ampliará para que:

- Solo procese una eliminación cuyo estado anterior fuera `pending`.
- Compruebe que el partido de equipo quedó con `recruiting_public = true`.
- Ignore eliminaciones por abandono, expulsión, cancelación u otros motivos.

Los miembros `declined` quedan expresamente excluidos. Un capitán que siga `pending` también cumple la misma regla.

Título: `El partido de [Equipo] está abierto`

Cuerpo: `¡Aún estás a tiempo de unirte!`

Ruta: `/match/[id]`

Clave de deduplicación: partido, participante y tipo `team_match_published`.

### 4. Plantilla completa

Se reutilizará la notificación inmediata existente cuando el partido cambia de `open` a `full`. Para un partido de equipo se utilizará el copy aprobado y el destinatario seguirá siendo exclusivamente el capitán.

El aviso se enviará una sola vez por partido aunque posteriormente alguien se dé de baja y se vuelva a completar.

Título: `Plantilla completa ✅`

Cuerpo: `¡[Partido] ya tiene a todos los jugadores listos!`

Ruta: `/match/[id]`

Clave de deduplicación existente: `match_full:[id]`.

Los partidos públicos ordinarios conservarán su copy y comportamiento actuales.

### 5. Plazas libres a 24 horas

El job existente consultará partidos dentro de una ventana alrededor de las 24 horas y avisará al capitán únicamente si:

- Es un partido de equipo futuro.
- Sigue siendo privado y no publicado.
- Continúa `open`.
- El número de confirmados sigue por debajo de la capacidad definida en `requested_positions`.

El aviso abre el detalle para que el capitán decida si ejecuta manualmente `Publicar plazas libres`. No llama a `publish_team_match` ni modifica el partido.

Título: `Aún quedan plazas para [Partido]`

Cuerpo: `¿Quieres abrirlo a Rondo?`

Ruta: `/match/[id]`

Clave de deduplicación: partido, capitán y tipo `team_publish_prompt`.

## Precisión temporal

El cron actual se ejecuta cada cinco minutos. Las consultas utilizarán ventanas suficientemente amplias para no perder una ejecución y la deduplicación garantizará un solo envío. Por ello, los avisos de 48 y 24 horas pueden llegar con un margen aproximado máximo de cinco minutos.

Un partido creado después de que haya pasado la ventana de 48 horas recibirá el aviso inmediato de creación, pero no un recordatorio retroactivo de 48 horas.

## Ciclo ordinario preservado

La nueva bifurcación se limita al estado `pending` durante la fase privada del equipo. Tras confirmar:

- `respond_to_series_match` cambia la participación a `joined`.
- El jugador puede darse de baja mediante el flujo ordinario y sus ventanas actuales.
- El recordatorio existente de 30 minutos incluye `joined` y `approved` sin filtrar por privacidad.
- La cancelación del partido avisa a participantes confirmados sin filtrar por privacidad.
- `update_completed_matches()` finaliza partidos `open` o `full` por fecha sin filtrar por privacidad.
- Las notificaciones del organizador y de los jugadores para valorar se generan por estado `completed` y participación confirmada, sin filtrar por privacidad.
- La asistencia automática sigue actuando solo sobre `joined` y `approved`.

No se cambiarán los copys ni las reglas de esos avisos existentes salvo el copy específico de `match_full` para partidos de equipo.

## Tipos, navegación e idempotencia

Los nuevos tipos internos serán:

- `team_match_created`
- `team_attendance_reminder`
- `team_match_published`
- `team_publish_prompt`

`match_full` se reutiliza para el aviso al capitán.

Todos los mensajes incluirán `match_id` y `url = /match/[id]`. La aplicación ya procesa esa ruta tanto en segundo plano como al abrirse desde una notificación.

Cada clave de deduplicación identificará de forma estable el tipo, partido y usuario. `sendPushMessages` seguirá considerando terminales los estados `sent` y `skipped`, mientras que un registro `failed` podrá reintentarse.

## Seguridad

- No se ampliará ninguna política RLS.
- Los webhooks seguirán autenticándose con `SEND_PUSH_WEBHOOK_SECRET`.
- El cron seguirá autenticándose con `CRON_SECRET`.
- Las consultas de partidos privados se ejecutarán únicamente dentro de Edge Functions con service role.
- El service role y los secretos no se expondrán al cliente.
- La función del trigger del capitán estará en el esquema privado, tendrá `search_path` fijo y permisos mínimos.
- La autorización para responder seguirá concentrada en `respond_to_series_match`.
- La autorización y la decisión de publicar seguirán concentradas en `publish_team_match`.
- El aviso de 24 horas no concede permisos ni ejecuta una publicación.

## Errores y recuperación

- Un fallo push no revertirá la creación, confirmación, publicación, cancelación o finalización de un partido.
- Los dispositivos sin token activo se registrarán como `skipped` mediante la infraestructura actual.
- Un error estructural de consulta hará responder a la Edge Function con error. Un fallo individual de Expo se devolverá en el resumen `failed` y quedará registrado en `push_notification_log` para diagnóstico y reintento.
- Los tickets `DeviceNotRegistered` seguirán desactivando el token inválido.
- Los envíos fallidos mantendrán una clave reintentable.
- La migración será transaccional e idempotente. Si no puede crear la membresía del capitán, no dejará un equipo nuevo a medias.

## Pruebas bloqueantes

### Capitán y datos

- Un equipo nuevo crea al capitán como miembro activo dentro de la misma transacción.
- Los equipos existentes quedan sin capitanes activos ausentes.
- Los partidos privados futuros no publicados quedan sin capitanes ausentes.
- El capitán aparece una sola vez en la ficha pública del equipo.
- El capitán puede responder `joined` o `declined` mediante `respond_to_series_match`.
- El capitán no puede abandonar ni autoexpulsarse.
- El capitán sí puede eliminar el equipo por el flujo existente.

### Destinatarios

- Un partido privado nuevo avisa a cada `pending`, incluido el capitán.
- Una solicitud pública `pending` sigue avisando al organizador y no usa el copy de equipo.
- El recordatorio de 48 horas solo incluye `pending` de un partido privado, abierto y con plazas.
- Publicar avisa a los antiguos `pending` y excluye `declined`.
- Completar el partido avisa una sola vez al capitán.
- El aviso de 24 horas llega solo al capitán de un partido privado incompleto.
- Un segundo paso del cron no duplica los avisos de 48 o 24 horas.

### Exclusiones y no regresión

- Partidos públicos, completos, cancelados, completados o pasados quedan excluidos cuando corresponda.
- Participantes `joined`, `approved`, `declined`, `dropped` o eliminados no reciben el recordatorio de 48 horas.
- Una baja o expulsión de un `pending` no se interpreta como publicación.
- Un participante confirmado de un partido privado puede darse de baja con las reglas ordinarias.
- Los confirmados reciben el recordatorio ordinario de 30 minutos.
- La finalización automática alcanza al partido privado.
- La cancelación avisa a sus confirmados.
- La asistencia y las valoraciones se generan con las reglas ordinarias.
- No se modifica el filtro `attended IS NOT NULL` de fiabilidad.

### Validación técnica

- `npx expo lint`
- `npx tsc --noEmit`
- `npm test`
- `git diff --check`
- Comprobación posterior en producción: cero equipos activos sin membresía activa del capitán.
- Comprobación posterior en producción: cero partidos privados futuros y no publicados sin participación del capitán.
- Confirmación de que las nuevas versiones de `send-push` y `scheduled-pushes` están activas.

Las comprobaciones estáticas y de base de datos no demuestran recepción ni navegación nativa. La prueba final requiere al menos dos cuentas y dispositivos o instalaciones reales para crear un partido, confirmar y rechazar asistencia, recibir ambos recordatorios temporales, completar la plantilla, publicar plazas y abrir el detalle desde cada push.

## Orden de despliegue

1. Volver a comprobar el diff, el esquema real y las versiones desplegadas.
2. Implementar y validar las Edge Functions y las pruebas sin modificar producción.
3. Generar la migración mediante Supabase CLI y mostrar el SQL exacto al usuario.
4. Esperar una confirmación específica antes de aplicar el DDL o el saneamiento de datos.
5. Desplegar primero `send-push` y `scheduled-pushes` para que los webhooks ya conozcan los nuevos contextos.
6. Aplicar la migración aprobada; el saneamiento del partido existente producirá el aviso correcto, no la solicitud pública antigua.
7. Ejecutar las consultas de verificación y los advisors de seguridad y rendimiento.
8. Confirmar versiones de las Edge Functions y revisar logs sin exponer tokens ni datos personales.
9. Completar la validación manual en dispositivo.

## Fuera de alcance

- Publicación automática del partido.
- Avisar a miembros que respondieron `declined` cuando el partido se hace público.
- Cambiar la frecuencia del cron existente.
- Crear una cola de notificaciones nueva.
- Añadir preferencias de notificación por equipo.
- Cambiar pagos, ventanas de cancelación, asistencia, fiabilidad o valoraciones.
- Modificar los avisos ordinarios que ya funcionan, salvo el copy de plantilla completa para partidos de equipo.
