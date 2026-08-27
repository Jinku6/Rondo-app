# Gestión de equipos: edición, avatar, expulsión y eliminación

## Objetivo

Completar la ficha de equipo para que el organizador pueda mantener sus datos y plantilla sin mezclar esa gestión con la configuración particular de cada partido.

La función visible «Pausar equipo» desaparece. En su lugar existe «Eliminar equipo», con eliminación lógica y conservación del historial.

## Jerarquía de la pantalla

La ficha mantiene la estética actual de Rondo y usa este orden:

1. Cabecera con avatar, nombre, ciudad y precio habitual.
2. Acción principal «Crear partido».
3. Próximos partidos.
4. Plantilla.
5. Gestión del equipo.
6. Zona peligrosa.

El avatar es circular. El organizador puede tocarlo como acceso rápido para cambiar la foto. Los demás usuarios lo ven sin controles de edición.

## Edición del equipo

«Editar equipo» abre un modal con:

- Foto del equipo.
- Nombre del equipo.
- Ciudad habitual, opcional.
- Precio habitual por jugador.

El nombre tendrá entre 3 y 100 caracteres. La ciudad vacía se guardará como `null`; si se informa, tendrá al menos 2 caracteres. El precio será un número entre 0 y 10.000.

El campo, fecha, hora, posiciones, nivel, descripción, colores y modo de aprobación continúan configurándose en cada partido. No se añadirán al equipo.

La foto reutiliza el patrón del perfil personal:

- Selección desde la galería.
- Recorte cuadrado 1:1.
- Calidad 0,5.
- JPG, PNG o WebP.
- Tamaño máximo de 2 MB.
- Almacenamiento en el bucket público `avatars`, bajo la carpeta del organizador y una subcarpeta propia del equipo.

Si el equipo no tiene foto, se muestran sus iniciales con el color de respaldo ya usado por Rondo.

## Expulsión de jugadores

Cada fila de la plantilla muestra una acción textual «Expulsar» para el organizador. El control tendrá un área táctil mínima de 48 dp y no dependerá únicamente del color para comunicar su función.

Antes de ejecutar la expulsión se muestra una confirmación que:

- Nombra al jugador.
- Indica que dejará la plantilla.
- Indica que perderá las reservas pendientes de futuros partidos privados.
- Aclara que las plazas ya confirmadas se conservan.
- Ofrece «Cancelar» y «Expulsar», con la segunda acción marcada como destructiva.

Al confirmar, una operación atómica:

1. Verifica sesión y propiedad del equipo.
2. Bloquea la membresía objetivo.
3. Cambia `series_members.status` a `removed`.
4. Elimina sus participaciones `pending` o `declined` en partidos futuros, privados y todavía no publicados del equipo.
5. Conserva participaciones `joined` o `approved`.

Una persona expulsada no puede volver a entrar mediante el mismo enlace de invitación. Este comportamiento ya forma parte de `join_match_series` y se conservará.

## Eliminación del equipo

«Eliminar equipo» aparece dentro de una zona peligrosa separada del resto de acciones. Sustituye a «Pausar equipo» y no ofrece reactivación desde la interfaz.

Antes de eliminar se comprueba si el equipo tiene partidos futuros en estado `open` o `full`:

- Si existen, la operación se bloquea. Se pide al organizador que los cancele o finalice primero.
- Si no existen, se muestra una confirmación destructiva que nombra al equipo y explica que desaparecerá de Rondo, aunque se conservará el historial de partidos.
- La confirmación ofrece «Cancelar» y «Eliminar equipo».

Al confirmar se realiza una eliminación lógica:

- `match_series.deleted_at` recibe la hora actual.
- `match_series.is_active` pasa a `false`.
- El equipo desaparece de listados, invitaciones y acceso directo.
- Se conservan `series_id`, plantilla y partidos históricos para mantener trazabilidad.

No se realiza `DELETE` físico desde el cliente.

## Datos y API

Se añadirá a `match_series`:

- `avatar_url text null`.
- `deleted_at timestamptz null`.

Las mutaciones sensibles se expondrán mediante RPC autenticadas:

- Actualizar los datos editables del equipo.
- Expulsar a un jugador y limpiar sus reservas no confirmadas.
- Eliminar lógicamente el equipo tras comprobar que no tiene partidos futuros.

Las funciones validarán `auth.uid()`, propiedad del equipo, estado no eliminado y límites de entrada. Usarán `SECURITY DEFINER` únicamente cuando sea necesario para completar la operación atómica, con `search_path` fijado, permisos revocados a `PUBLIC` y `anon`, y ejecución concedida solo a `authenticated`.

Se retirará la capacidad de borrado físico directo de `match_series`. Las consultas y helpers del equipo excluirán `deleted_at IS NOT NULL`. La app repetirá ese filtro de forma explícita en sus listados como defensa adicional.

## Estados y errores

Durante cualquier mutación, la acción correspondiente queda deshabilitada y muestra progreso. Todos los flujos asíncronos usan `try/catch/finally`.

Los errores se presentan como mensajes legibles de Rondo. Nunca se renderiza directamente un objeto de error. Si una actualización de foto falla después de subir el archivo, se conserva el estado anterior del equipo y se informa al organizador.

Tras editar o expulsar se recarga la ficha. Tras eliminar, se navega a «Mis partidos» y el equipo deja de aparecer.

## Verificación

Se comprobará como mínimo:

- El organizador puede editar nombre, ciudad, precio y avatar.
- Un miembro no puede editar, expulsar ni eliminar.
- Los límites de texto, precio, formato y tamaño de imagen se aplican.
- La expulsión exige confirmación y bloquea el reingreso con el mismo enlace.
- La expulsión elimina `pending`/`declined` futuros privados y conserva `joined`/`approved`.
- La eliminación exige confirmación.
- La eliminación se bloquea si hay partidos futuros `open` o `full`.
- Un equipo eliminado no aparece en «Mis equipos», no admite invitaciones y no abre mediante su ruta directa.
- Los partidos históricos siguen relacionados con el equipo eliminado a nivel de datos.
- `npx expo lint`, `npx tsc --noEmit` y `npm test` pasan.
- Las políticas y RPC se verifican con usuarios organizador, miembro y externo.

No se incluye automatización, cron ni notificaciones de la Fase 2.
