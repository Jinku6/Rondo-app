# Plan de implementación: ficha pública de equipos

## Alcance

Implementar `docs/superpowers/specs/2026-08-28-ficha-publica-equipos-design.md` como cierre de la Fase 1. No incluye cron, automatización ni notificaciones.

## Lote 1 — Contrato público de mínimo privilegio

### Base de datos

1. Crear una migración con la CLI después de que el usuario apruebe el SQL exacto.
2. Añadir `match_series.description`, nullable y limitado a 300 caracteres.
3. Sustituir la firma de `update_team_details(...)` para validar y guardar la descripción.
4. Añadir `get_public_team(uuid)`, que devuelve solo los campos públicos del equipo, el capitán, la plantilla activa sin duplicados y el total de partidos completados.
5. Añadir `get_public_user_teams(uuid)`, que devuelve solo foto, nombre y ciudad de los equipos activos del usuario.
6. Mantener sin cambios las RLS de `matches`, `match_participants`, `match_series` y `series_members`.
7. Revocar ejecución a `PUBLIC` y `anon`; concederla únicamente a `authenticated` y `service_role`.

### Verificación

- Probar autenticación obligatoria.
- Probar equipo activo, eliminado e inexistente.
- Verificar que capitán y miembros no se duplican.
- Verificar que los integrantes eliminados no aparecen.
- Verificar que no se devuelven `invite_code`, precio ni configuración interna.
- Verificar el total de partidos `completed`.
- Ejecutar advisors de seguridad y rendimiento.

## Lote 2 — Modelos y carga de datos

### Archivos previstos

- `types/series.ts`
- `app/group/[id].tsx`
- `app/user/[id].tsx`

### Cambios

1. Añadir tipos explícitos para la ficha pública, su plantilla y las tarjetas de perfil.
2. Hacer que la ficha cargue datos públicos mediante `get_public_team(...)` para todos los usuarios autenticados.
3. Mantener una consulta relacionada separada para datos privados y controles del capitán.
4. Consultar próximos partidos con la RLS existente, sin introducir atajos públicos.
5. Cargar `get_public_user_teams(...)` junto con el perfil público y conservar resultados parciales si una de las dos lecturas falla.

### Verificación tras el lote

- `npx expo lint`
- `npx tsc --noEmit`
- `npm test`

## Lote 3 — Capitán, descripción y estadísticas

### Archivos previstos

- `app/group/[id].tsx`
- `components/team/TeamEditModal.tsx`
- `app/(tabs)/create.tsx`

### Cambios

1. Añadir la descripción a creación y edición, con máximo de 300 caracteres y filtro de vocabulario.
2. Mostrar descripción bajo la identidad del equipo.
3. Mostrar al capitán como primera fila y con etiqueta, sin acción de expulsión.
4. Contar capitán y miembros activos una sola vez en «Plantilla».
5. Añadir «Partidos jugados» junto a «Plantilla».
6. Sustituir el término visible «organizador» por «capitán» dentro del flujo de equipos.
7. Cambiar «pachanga» por «partido» en todos los avisos de eliminación.

### Verificación tras el lote

- `npx expo lint`
- `npx tsc --noEmit`
- `npm test`

## Lote 4 — Jerarquía visual y perfil público

### Archivos previstos

- `app/group/[id].tsx`
- `components/team/TeamEditModal.tsx`
- `app/user/[id].tsx`
- Componente pequeño de tarjeta pública de equipo si evita duplicación.

### Cambios

1. Rehacer «Crear partido» y «Guardar cambios» con el patrón visual de «Finalizar partido».
2. Rehacer gestión como filas horizontales del mockup: texto a la izquierda e icono a la derecha.
3. Mantener la eliminación en una tarjeta roja separada con la misma geometría.
4. Garantizar áreas táctiles mínimas de 48 dp, estados de pulsación y carga, y etiquetas accesibles.
5. Añadir al perfil público una sección «Equipos» con foto, nombre y ciudad; cada tarjeta abre la ficha pública.

### Verificación tras el lote

- `npx expo lint`
- `npx tsc --noEmit`
- `npm test`
- Revisión estática de accesibilidad y `git diff --check`.
- Prueba en dispositivo real de iOS con ancho pequeño y tamaño de texto aumentado.

## Cierre de Fase 1

1. Repetir pruebas de RPC con capitán, miembro y usuario externo.
2. Confirmar que un externo no puede leer partidos privados.
3. Confirmar que los botones coinciden con el mockup en dispositivo real.
4. Crear commits lógicos de base de datos, datos/seguridad y UI.
5. No comenzar la Fase 2 hasta recibir confirmación de la prueba real.
