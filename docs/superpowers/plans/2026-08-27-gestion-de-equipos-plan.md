# Plan de implementación: gestión de equipos

## Alcance

Implementar el diseño aprobado en `docs/superpowers/specs/2026-08-27-gestion-de-equipos-design.md`. No incluye automatización, cron ni notificaciones.

## Lote 1 — Contrato seguro de base de datos

### Archivos

- Nueva migración de Supabase creada con la CLI.

### Cambios

1. Añadir `avatar_url` y `deleted_at` a `match_series`, con validaciones de longitud y URL HTTPS para la foto.
2. Actualizar helpers y políticas para que un equipo eliminado no sea legible ni accesible desde cliente.
3. Crear `update_team_details(...)` para editar nombre, ciudad, precio y avatar con validación de sesión y propiedad.
4. Crear `remove_team_member(...)` para expulsar de forma atómica y limpiar solo participaciones futuras `pending`/`declined` de partidos privados no publicados.
5. Crear `delete_team(...)` para bloquear si hay partidos futuros `open`/`full` y, en caso contrario, establecer `deleted_at` e `is_active=false`.
6. Impedir `DELETE` físico de equipos desde `authenticated` y retirar las mutaciones directas que el cliente ya no necesita.
7. Mantener `join_match_series(...)` incompatible con equipos eliminados y actualizar su copy visible a «equipo».

### Verificación

- Enseñar el SQL exacto y esperar aprobación antes de aplicarlo.
- Probar RPC con organizador, miembro y usuario externo dentro de transacciones con rollback.
- Verificar bloqueo de eliminación con partidos futuros.
- Verificar limpieza selectiva de reservas al expulsar.
- Ejecutar advisors de seguridad y rendimiento.

## Lote 2 — Edición y avatar

### Archivos

- `app/group/[id].tsx`
- `types/series.ts`
- Helper mínimo de avatar si evita duplicar validación existente.

### Cambios

1. Añadir avatar a la cabecera, con iniciales como respaldo.
2. Añadir modal «Editar equipo» para foto, nombre, ciudad y precio habitual.
3. Reutilizar selector 1:1, formatos permitidos y límite de 2 MB del perfil.
4. Subir a `avatars/{organizer_id}/teams/{team_id}/...` y guardar mediante `update_team_details(...)`.
5. Recargar la ficha tras guardar y conservar el estado anterior ante errores.

### Verificación tras cada cambio

- `npx expo lint`
- `npx tsc --noEmit`
- `npm test`

## Lote 3 — Plantilla y gestión

### Archivos

- `app/group/[id].tsx`
- `app/(tabs)/mymatches.tsx`

### Cambios

1. Reordenar la pantalla: información, partido, próximos, plantilla, gestión y zona peligrosa.
2. Hacer visible «Expulsar» en cada fila, con confirmación que explique sus efectos.
3. Invocar `remove_team_member(...)`, bloquear dobles pulsaciones y recargar.
4. Añadir gestión del equipo debajo de la plantilla con «Editar equipo» y «Compartir invitación».
5. Sustituir «Pausar equipo» por «Eliminar equipo» con confirmación destructiva.
6. Invocar `delete_team(...)`; si está bloqueado, mostrar el motivo. Si termina, volver a «Mis partidos».
7. Excluir equipos eliminados explícitamente en listados y contextos de creación.

### Verificación tras cada cambio

- `npx expo lint`
- `npx tsc --noEmit`
- `npm test`
- Comprobar áreas táctiles de al menos 48 dp y etiquetas accesibles.

## Cierre

1. Ejecutar `git diff --check`.
2. Ejecutar lint, TypeScript y toda la suite.
3. Repetir pruebas de autorización y estado contra Supabase.
4. Crear commits separados para base de datos y cliente.
5. Entregar checklist de prueba en dispositivo real.
