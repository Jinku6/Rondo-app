# Equipos y partidos privados con apertura pública

## Objetivo

Sustituir el concepto visible de «grupo fijo» por «equipo» y permitir que el organizador cree desde cada equipo un partido con el mismo formulario y las mismas opciones que un partido normal de Rondo.

El partido nace privado para la plantilla del equipo. Todos sus miembros deben confirmar si van. Si quedan plazas, el organizador puede publicarlo de forma irreversible; desde ese momento cualquier usuario de Rondo, incluidos los miembros del equipo que no confirmaron a tiempo, entra mediante el flujo normal de unión o solicitud.

La automatización semanal, cron y recordatorios quedan fuera de este cambio.

## Terminología

- La interfaz utilizará siempre «equipo» y «plantilla».
- Las rutas y nombres técnicos existentes (`/group/[id]`, `match_series`, `series_members` y `series_id`) se mantienen para evitar migraciones y refactorizaciones cosméticas.
- Un «partido del equipo» es cualquier fila de `matches` con `series_id`.
- Un «partido privado del equipo» tiene `is_private = true` y `recruiting_public = false`.
- Un «partido del equipo publicado» conserva `series_id`, mantiene `is_private = true` y pasa a `recruiting_public = true`.

Mantener `is_private = true` después de publicar conserva la procedencia del partido y reutiliza el modelo ya previsto. La experiencia pública se determina con `recruiting_public = true`.

## Creación del partido

### Navegación

La acción principal de la ficha del equipo será «Crear partido». Abrirá el creador normal con el identificador del equipo como parámetro. No se mantendrá el modal reducido de fecha y hora.

El creador mostrará el formulario completo de un partido normal y precargará:

- El nombre del equipo como título.
- La ciudad del equipo como contexto inicial para buscar la ubicación.
- El precio habitual del equipo.

Serán editables para cada partido:

- Título.
- Fecha y hora.
- Campo y ubicación geolocalizada.
- Posiciones solicitadas y aforo total.
- Nivel.
- Descripción.
- Colores de los equipos.
- Precio.
- Admisión automática o revisión del organizador.

La ciudad del equipo no sustituye una ubicación válida. El partido debe cumplir las mismas validaciones de geolocalización que uno normal.

### Persistencia atómica

La interfaz compartirá las mismas validaciones y controles, pero usará dos adaptadores de guardado:

- Partido normal: inserción existente en `matches`.
- Partido de equipo: nueva RPC autenticada `create_team_match(...)`.

`create_team_match(...)` recibirá todos los datos editables del partido y realizará en una sola transacción:

1. Validar `auth.uid()`.
2. Comprobar que el usuario es organizador del equipo y que el equipo está activo.
3. Validar fecha futura, ubicación, precio, mínimo, posiciones y valores enumerados.
4. Crear el partido con `series_id`, `is_private = true` y `recruiting_public = false`.
5. Añadir todos los miembros activos del equipo a `match_participants` con `status = 'pending'`.

La función no utilizará `service_role`. Será `SECURITY DEFINER`, fijará un `search_path` seguro, tendrá ejecución revocada para `PUBLIC` y `anon`, y concedida únicamente a `authenticated`.

## Confirmación privada

Mientras el partido tenga `is_private = true` y `recruiting_public = false`:

- Solo el organizador, los miembros activos del equipo y los participantes relacionados pueden leerlo.
- Cada miembro pendiente puede responder «Voy» (`joined`) o «No voy» (`declined`) mediante `respond_to_series_match`.
- Los `pending` no se convierten en `approved` y no entran en `auto_confirm_attendance()` ni en el cálculo de fiabilidad.
- La admisión automática o revisada no afecta a los miembros durante esta fase privada; se aplicará a usuarios que intenten entrar después de la publicación.

Los controles especiales «Voy» y «No voy» solo se mostrarán cuando el partido siga en esta fase privada. No basta con comprobar que exista `series_id`.

## Publicación de plazas libres

### Acción del organizador

La ficha del partido mostrará «Publicar plazas libres» únicamente cuando:

- El usuario sea el organizador.
- El partido pertenezca a un equipo.
- Siga privado y sin publicar.
- Su estado permita nuevas incorporaciones.
- El número de participantes `joined` sea inferior al aforo total derivado de `requested_positions`.

La interfaz mostrará una confirmación clara: la publicación es irreversible y quienes no hayan confirmado perderán la reserva.

### Transición atómica

La nueva RPC autenticada `publish_team_match(p_match_id uuid)` realizará en una sola transacción:

1. Validar `auth.uid()`.
2. Bloquear el partido para evitar publicaciones concurrentes.
3. Comprobar que quien llama es el organizador.
4. Comprobar que es un partido privado de equipo, no publicado y con plazas libres.
5. Eliminar las filas `pending` y `declined` de los miembros de ese equipo para ese partido.
6. Establecer `recruiting_public = true`.
7. Mantener las filas `joined`, `series_id` e `is_private = true`.

Se eliminan también los `declined` para que un miembro que cambie de opinión pueda volver a entrar mediante el flujo normal sin chocar con la restricción única `(match_id, user_id)`.

### Comportamiento público

Cuando `recruiting_public = true`, el partido se comportará como cualquier partido público:

- Aparece en búsquedas y listados generales conforme a la RLS y a `partidos_cerca`.
- Cualquier usuario autenticado puede pulsar «Unirme».
- Con admisión automática se crea una participación `joined`.
- Con revisión se crea una participación `pending` que solo el organizador puede aprobar o rechazar.
- Un miembro activo del equipo que perdió su reserva usa exactamente este mismo flujo.
- No se muestran «Voy» y «No voy» ni se llama a `respond_to_series_match`.

La publicación no cambia automáticamente `requires_approval`; respeta la elección realizada en el formulario.

## Componentes y responsabilidades

### `app/(tabs)/create.tsx`

- Leerá un parámetro opcional de equipo.
- Cargará únicamente equipos que el usuario organiza y que la RLS permita leer.
- Precargará título, ciudad y precio una vez, sin sobrescribir ediciones posteriores.
- Reutilizará el formulario normal completo.
- Elegirá el adaptador de guardado normal o `create_team_match(...)`.
- Mostrará errores accionables y conservará los datos del formulario si falla el envío.

### `app/group/[id].tsx`

- Cambiará el copy visible de grupo a equipo.
- Sustituirá el modal reducido por navegación al creador completo.
- Mantendrá plantilla, invitación, partidos próximos y controles del organizador.

### `app/match/[id].tsx` y detalle compartido

- Distinguirán explícitamente entre fase privada y fase publicada.
- Mantendrán la confirmación `joined/declined` solo durante la fase privada.
- Mostrarán la publicación únicamente al organizador y cuando haya aforo.
- Tras publicar, usarán el flujo normal de unión y aprobación.

### Superficies visibles restantes

Los textos de creación, invitación, pestaña Partidos, unión y estados vacíos cambiarán de «grupo» a «equipo». No se renombrarán rutas, tablas, tipos internos ni migraciones existentes.

## Errores y concurrencia

- Todos los flujos asíncronos usarán `try/catch/finally` cuando gestionen estado de carga.
- Los botones quedarán deshabilitados durante el envío para evitar dobles pulsaciones.
- Las RPC devolverán errores semánticos para sesión ausente, permisos, partido ya publicado, partido completo y datos inválidos.
- La publicación bloqueará la fila del partido y volverá a calcular el aforo dentro de la transacción.
- Si dos solicitudes de publicación compiten, solo una podrá efectuar la transición; la segunda recibirá el estado ya publicado.
- La creación atómica evitará partidos sin plantilla si falla una inserción.

## Seguridad y RLS

- No se expondrán claves privilegiadas en el cliente.
- Las RPC comprobarán autorización internamente; no dependerán solo de que el botón esté oculto.
- Un partido con `is_private = true` y `recruiting_public = false` seguirá excluido de `partidos_cerca`, listados generales y usuarios ajenos.
- Al pasar a `recruiting_public = true`, la política existente permite lectura pública autenticada sin revelar el resto del equipo.
- Las consultas de participantes conservarán las restricciones de relación actuales.
- Un miembro del equipo no podrá autoaprobar una solicitud pública: `respond_to_series_match` no se invocará en fase pública y la aprobación seguirá reservada al organizador.

## Migración prevista

La implementación necesitará una migración para:

- Crear `create_team_match(...)`.
- Crear `publish_team_match(uuid)`.
- Revocar y conceder permisos de ejecución explícitos.
- Ajustar funciones o políticas únicamente si las pruebas del esquema real demuestran que el flujo normal público no queda cubierto.

Antes de aplicar esta migración se presentará el SQL completo y exacto para aprobación. No se desplegará ninguna migración sin ese visto bueno.

## Verificación

### Base de datos

- Un usuario ajeno no puede crear un partido para otro equipo.
- La creación genera un partido privado y una fila `pending` por miembro activo.
- Ejecutar la creación con datos inválidos no deja filas parciales.
- `auto_confirm_attendance()` no modifica participantes `pending` o `declined`.
- Antes de publicar, un usuario ajeno no puede leer el partido y `partidos_cerca` no lo devuelve.
- Solo el organizador puede publicar.
- Publicar conserva `joined`, elimina `pending/declined` y activa `recruiting_public`.
- Después de publicar, un antiguo pendiente puede unirse directamente o solicitar acceso según `requires_approval`.
- Un miembro del equipo no puede usar la confirmación privada para autoaprobarse después de publicar.
- Publicar dos veces no altera participantes ni produce estados incoherentes.

### Aplicación

- El creador del equipo muestra todos los campos del creador normal.
- Nombre, ciudad y precio aparecen precargados una sola vez.
- Las ediciones del usuario no se pierden durante errores o recargas.
- Todos los miembros ven el partido privado y pueden responder.
- El organizador ve el número real de plazas antes de publicar.
- Tras publicar desaparecen los controles de equipo y aparece el flujo normal.
- El partido sigue visible en la ficha e historial del equipo.
- Toda la interfaz usa «equipo» y no «grupo» para esta funcionalidad.

### Validación técnica

- `npx expo lint` después de cada cambio de código.
- `npx tsc --noEmit` después de cada cambio de lógica.
- `npm test` al cerrar cada lote.
- Export web de Expo al cerrar la implementación.
- Prueba en dispositivo real antes de considerar terminada la fase.

## Fuera de alcance

- Generación automática semanal.
- Cron, recordatorios o notificaciones push nuevas.
- Publicación automática por deadline.
- Chat persistente del equipo.
- Renombrado físico de tablas, columnas o rutas.
- Cambios en `auto_confirm_attendance()` o en el filtro de fiabilidad.
