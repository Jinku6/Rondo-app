# Plan de implementación: equipos y partidos privados

## Alcance

Implementar el diseño aprobado en `docs/superpowers/specs/2026-08-25-equipos-y-partidos-privados-design.md` sin automatización, cron ni pushes. Cada lote se valida antes de comenzar el siguiente.

## Lote 1 — Contrato seguro de base de datos

### Archivos

- `supabase/migrations/20260825173455_team_match_creation_and_publishing.sql`

### Cambios

1. Añadir `private.can_join_match(uuid, uuid, text)` para autorizar altas únicamente en partidos descubribles, abiertos y con el estado correcto según `requires_approval`.
2. Sustituir la política `Participants: insert self` para impedir que un usuario se inserte en un partido privado o se autoapruebe en uno sujeto a revisión.
3. Restringir la inserción directa de `matches.series_id`: los partidos de equipo solo pueden nacer mediante la operación atómica.
4. Añadir un trigger que impida modificar directamente `series_id`, `is_private` o `recruiting_public` de un partido de equipo fuera de la transición controlada.
5. Crear `create_team_match(...)` para validar y crear partido + plantilla de forma atómica.
6. Crear `publish_team_match(uuid)` para bloquear, verificar aforo, eliminar `pending/declined` y activar `recruiting_public` de forma irreversible.
7. Endurecer `respond_to_series_match(uuid,text)` para que solo funcione durante la fase privada y respete el aforo.
8. Revocar la ejecución cliente de `create_manual_series_match`; el creador nuevo y la migración se entregan en el mismo lote para no mantener un camino que pueda reinsertar pendientes después de publicar.

### Verificación

- Ejecutar la migración únicamente después de aprobación explícita.
- Probar las RPC con roles `authenticated` simulando organizador, miembro y usuario ajeno.
- Verificar que un usuario ajeno no puede insertar una participación en el partido privado.
- Verificar que `partidos_cerca` no devuelve el partido antes de publicar y sí lo devuelve después.
- Verificar que la publicación conserva `joined`, elimina `pending/declined` y no puede revertirse.
- Ejecutar los advisors de seguridad y rendimiento.

## Lote 2 — Creador normal reutilizado por el equipo

### Archivos

- `app/(tabs)/create.tsx`
- `app/group/[id].tsx`
- Tipos o helpers mínimos si TypeScript los requiere.

### Cambios

1. Leer un parámetro opcional `teamId` en el creador.
2. Cuando exista, cargar un equipo activo organizado por el usuario.
3. Precargar una sola vez:
   - título con el nombre del equipo;
   - precio con su precio habitual;
   - ciudad en el texto de ayuda del buscador de ubicación, sin fingir una selección geolocalizada.
4. Mantener todos los campos y validaciones del partido normal.
5. Enviar el formulario normal mediante inserción directa y el formulario de equipo mediante `create_team_match(...)`.
6. Navegar al partido creado sin borrar el borrador si falla.
7. Sustituir el modal reducido de la ficha del equipo por navegación al creador con `teamId`.

### Verificación tras el cambio

- `npx expo lint`
- `npx tsc --noEmit`
- `npm test`
- Crear un partido normal para comprobar que no cambió su comportamiento.
- Crear un partido de equipo y verificar todos los campos guardados.

## Lote 3 — Confirmación privada y publicación pública

### Archivos

- `app/match/[id].tsx`
- `components/match/MatchDetailContent.tsx`
- Tests de lógica extraída, si se añade un helper puro para aforo/estado.

### Cambios

1. Reemplazar `isSeriesMatch` como selector de experiencia por dos estados explícitos:
   - partido privado del equipo;
   - partido del equipo ya publicado.
2. Mostrar «Voy/No voy» solo en la fase privada.
3. Tras publicar, reutilizar el CTA normal de unión y las solicitudes normales.
4. Mostrar solicitudes pendientes al organizador también para un partido de equipo publicado.
5. Añadir «Publicar plazas libres» al panel del organizador cuando haya aforo.
6. Mostrar confirmación irreversible con el número de miembros pendientes que perderán la reserva.
7. Invocar `publish_team_match`, recargar partido y participantes, y mostrar errores accionables.
8. Mantener el partido enlazado y visible en el equipo.

### Verificación tras el cambio

- `npx expo lint`
- `npx tsc --noEmit`
- `npm test`
- Comprobar entrada automática y revisión del organizador después de publicar.
- Comprobar que un miembro tardío sigue el flujo público y no puede autoaprobarse.

## Lote 4 — Terminología visible «equipo»

### Archivos

- `app/(tabs)/create.tsx`
- `app/(tabs)/mymatches.tsx`
- `app/group/[id].tsx`
- `app/join/[code].tsx`
- `app/match/[id].tsx`
- `components/match/MatchDetailContent.tsx`
- Helpers de invitación/copy si contienen texto visible.

### Cambios

1. Cambiar «grupo», «grupo fijo» y derivados por «equipo» en esta funcionalidad.
2. Mantener los nombres técnicos y rutas actuales.
3. Revisar accesibilidad, estados vacíos, alertas e invitaciones.
4. Mantener voz de vestuario y evitar copy corporativo.

### Verificación tras el cambio

- Buscar copy residual con `rg`.
- `npx expo lint`
- `npx tsc --noEmit`
- `npm test`

## Cierre

1. Ejecutar `git diff --check`.
2. Ejecutar export web de Expo.
3. Repetir pruebas de RLS y RPC contra Supabase.
4. Crear commits separados para backend, creador, detalle/publicación y terminología.
5. Entregar checklist de dispositivo real:
   - crear equipo;
   - crear partido completo desde el equipo;
   - responder con dos miembros;
   - publicar con pendientes;
   - unirse como miembro tardío;
   - unirse como usuario ajeno con admisión automática y revisada.
