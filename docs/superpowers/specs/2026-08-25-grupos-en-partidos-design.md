# Grupos recurrentes en la pestaña Partidos

## Objetivo

Conseguir que un grupo recurrente recién creado se pueda abrir correctamente, que su ficha mantenga el mismo lenguaje visual que el detalle de partido y que todos los grupos accesibles para el usuario aparezcan en la pestaña Partidos.

El cambio pertenece exclusivamente a la Fase 1. No introduce automatización, cron ni notificaciones nuevas.

## Diagnóstico

La navegación llega a `app/group/[id].tsx` y las consultas de `match_series` y `matches` responden correctamente. La carga falla en `series_members` con HTTP 300 y el código PostgREST `PGRST201`.

`series_members` tiene dos claves foráneas hacia `users`: `user_id` e `invited_by`. La relación embebida `user:users(...)` es ambigua. La consulta debe seleccionar explícitamente `users!series_members_user_id_fkey(...)`.

No hace falta modificar el esquema ni aplicar una migración.

## Enfoque aprobado

Se reutilizarán los componentes visuales y la jerarquía del detalle de partido, sin transformar el grupo en un partido ficticio. De este modo cada pantalla conserva su modelo de datos y sus acciones reales, mientras comparte el mismo lenguaje visual.

### Ficha del grupo

La pantalla tendrá:

- Cabecera sin título nativo, con botón de volver y acción de compartir.
- Bloque de título equivalente al detalle de partido.
- Badges visibles para `Grupo fijo` y `Activo` o `Pausado`.
- Tarjeta de ubicación con la ciudad y el texto que aclara que el campo se decide en cada pachanga.
- Celdas informativas para el número de jugadores de la plantilla y el mínimo para jugar.
- Acción principal `Crear esta semana` para el organizador.
- Acción secundaria para compartir la invitación.
- Sección de próximos partidos con `MatchCard`.
- Sección de plantilla con `PlayerRow` y acceso al perfil de cada jugador.
- Panel del organizador con la acción de pausar o reactivar el grupo, separada de las acciones principales.

Los controles táctiles tendrán al menos 48 puntos, etiquetas de accesibilidad y estado visual deshabilitado durante operaciones asíncronas.

### Pestaña Partidos

Se añadirá una sección `Mis grupos` dentro de la cabecera de `app/(tabs)/mymatches.tsx`, antes de los filtros de partidos.

La consulta leerá `match_series` sin ampliar permisos: las políticas RLS existentes determinarán qué grupos puede ver el usuario. Cada tarjeta mostrará:

- Nombre del grupo.
- Ciudad o `Sin ciudad definida`.
- Rol `Organizo` o `Plantilla`.
- Estado `Activo` o `Pausado`.
- Indicador visual de navegación.

Al pulsar una tarjeta se navegará a `/group/[id]` mediante `router.push`, conservando el historial para que el botón de volver regrese a Partidos.

## Flujo de datos y estados

La carga de grupos será independiente de la lista de partidos. Si falla:

- Los partidos seguirán mostrándose.
- La sección de grupos mostrará un error breve con una acción para reintentar.
- El error técnico completo se registrará mediante los helpers existentes de Supabase.

Durante la carga inicial se conservará el indicador existente. En recargas posteriores se mantendrá el contenido anterior para evitar parpadeos. Cuando no haya grupos, se mostrará un estado vacío compacto con acceso a la pantalla de creación.

La ficha del grupo distinguirá entre:

- Carga inicial sin datos: indicador centrado.
- Error sin datos: mensaje y reintento.
- Recarga con datos: contenido visible y `RefreshControl` activo.

## Seguridad

- No se cambia ninguna política RLS.
- No se usa una clave privilegiada desde el cliente.
- La lista de grupos depende de las políticas actuales de `match_series`.
- La consulta de miembros se desambigua por la clave foránea de `user_id`; no expone al usuario que envió la invitación.

## Verificación

- Confirmar en logs o mediante una llamada real que `series_members` deja de responder con `PGRST201`.
- Abrir el grupo inmediatamente después de crearlo.
- Abrir el mismo grupo desde `Mis grupos` en la pestaña Partidos.
- Comprobar volver, compartir, crear partido semanal, recarga y estados vacíos.
- Verificar que un miembro activo también ve el grupo y que un usuario ajeno no lo recibe por RLS.
- Ejecutar `npx expo lint`, `npx tsc --noEmit`, `npm test` y `git diff --check`.

## Fuera de alcance

- Edición completa de los datos del grupo.
- Automatización semanal y cron.
- Publicación automática de plazas libres.
- Cambios en `auto_confirm_attendance()` o en el cálculo de fiabilidad.
