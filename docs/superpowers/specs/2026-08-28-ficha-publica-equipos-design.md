# Ficha pública y jerarquía visual de equipos

## Objetivo

Completar la Fase 1 de equipos antes de comenzar la automatización. La ficha debe corregir sus acciones visuales, reconocer al capitán como parte de la plantilla, mostrar actividad histórica y poder visitarse desde el perfil público de cualquier integrante sin exponer datos internos.

## Terminología

En toda la interfaz visible, la persona propietaria del equipo se denomina «Capitán». El esquema mantiene `organizer_id` para evitar una migración semántica sin beneficio funcional.

## Datos editables del equipo

El capitán puede editar:

- Foto.
- Nombre.
- Ciudad habitual opcional.
- Descripción opcional.
- Precio habitual por jugador.

La descripción tendrá un máximo de 300 caracteres, se guardará como `null` cuando quede vacía y pasará por el filtro de vocabulario del cliente. No se copiará automáticamente a los partidos: cada partido conserva su propia descripción.

## Ficha pública segura

La lectura pública se realizará mediante funciones autenticadas de solo lectura. No se ampliará la política `SELECT` general de `match_series`, porque la tabla contiene `invite_code` y configuración interna.

La versión pública de un equipo activo y no eliminado expondrá únicamente:

- Identificador.
- Foto.
- Nombre.
- Ciudad.
- Descripción.
- Identidad pública del capitán.
- Plantilla activa completa con los campos ya permitidos por `PUBLIC_USER_SELECT`.
- Total de partidos del equipo en estado `completed`.

No expondrá:

- Código o enlace de invitación.
- Precio habitual.
- Configuración recurrente o de aprobación.
- Datos de miembros eliminados.
- Partidos privados que el visitante no pueda leer mediante la RLS normal de `matches`.

Los integrantes y el capitán conservarán el acceso relacionado actual. Los controles de edición, invitación, expulsión y eliminación solo se renderizarán para el capitán.

## Equipos en el perfil público

El perfil público de un usuario añadirá únicamente una sección «Equipos». Incluirá todos los equipos activos y no eliminados de los que sea capitán o miembro activo.

Se mostratá mediante una card nueva de ancho completo que se ubicará entre la bio y la fila de edad, posición y fiabilidad.

La tarjeta abrirá `/group/[id]`. No mostrará estadísticas personales, códigos de invitación, precio ni información interna del equipo.

## Capitán y plantilla

El capitán aparecerá como primera fila de la plantilla, con la etiqueta visible «Capitán». Contará una sola vez en el total aunque exista accidentalmente una membresía activa para su mismo usuario.

El resto de miembros activos aparecerá después, ordenado por fecha de entrada. Solo esas filas mostrarán «Expulsar» al capitán; el capitán nunca podrá expulsarse a sí mismo.

La zona de información tendrá dos tarjetas del mismo ancho:

- «Plantilla»: capitán más miembros activos sin duplicados.
- «Partidos jugados»: número de partidos del equipo con `status='completed'`.

## Partidos visibles

La ficha seguirá consultando los próximos partidos mediante la RLS existente de `matches`:

- Capitán e integrantes pueden ver los partidos privados del equipo.
- Un visitante externo solo puede ver partidos públicos o con plazas publicadas que ya sean descubribles.
- La lectura pública del equipo no modifica las garantías de privacidad de los partidos.

## Corrección visual

La implementación seguirá el mockup aprobado de la opción A:

1. Cabecera con foto, nombre, ciudad y descripción.
2. Acción principal «Crear partido» solo para el capitán.
3. Próximos partidos visibles para el usuario actual.
4. Plantilla completa con el capitán primero.
5. Gestión del equipo.
6. Zona peligrosa.

«Crear partido» y «Guardar cambios» usarán el patrón de «Finalizar partido»: ancho completo, altura mínima de 52 dp, fondo verde, texto oscuro en mayúsculas, icono y sombra de marca.

Las filas «Editar equipo» y «Compartir invitación» tendrán texto y subtítulo alineados a la izquierda, con un único icono verde a la derecha. La fila completa será pulsable y tendrá una altura mínima de 56 dp.

«Eliminar equipo» usará la misma composición en una tarjeta roja separada. Todos los controles tendrán un área táctil mínima de 48 dp y estado de pulsación o carga perceptible.

Los mensajes de bloqueo, confirmación y éxito de la eliminación usarán «partido» o «partidos», nunca «pachanga».

## Contrato de base de datos

Se añadirá `description text null` a `match_series`, con límite de 300 caracteres.

La RPC de edición existente se ampliará para aceptar y validar la descripción. Se añadirán lecturas autenticadas de mínimo privilegio para:

- Obtener la ficha pública de un equipo, su capitán, su plantilla y su total de partidos completados.
- Obtener los equipos públicos a los que pertenece un usuario.

Las funciones fijarán `search_path`, comprobarán que el solicitante está autenticado y solo devolverán equipos activos y no eliminados. Se revocará ejecución a `PUBLIC` y `anon`, y se concederá únicamente a `authenticated` y `service_role`.

No se cambiarán las políticas de lectura de `matches`, `match_participants` ni los filtros de privacidad pública.

## Estados y errores

- Las lecturas públicas mostrarán un estado vacío si el usuario no pertenece a ningún equipo.
- Una ficha inexistente, eliminada o inactiva se tratará como no encontrada.
- Los fallos de lectura no expondrán objetos ni mensajes internos de Supabase.
- Las acciones asíncronas usarán `try/catch/finally`, deshabilitarán dobles pulsaciones y mostrarán progreso.
- La seguridad del servidor será autoritativa; la ocultación de botones en cliente no sustituirá la autorización.

## Verificación

Se comprobará como mínimo:

- El botón de guardado y las acciones de la ficha coinciden con el mockup en un dispositivo real.
- El capitán aparece primero, tiene etiqueta y cuenta una sola vez.
- El total de plantilla incluye capitán y miembros activos.
- «Partidos jugados» cuenta únicamente partidos `completed` del equipo.
- La descripción se crea, edita, limita a 300 caracteres y aparece públicamente.
- El perfil público muestra todos los equipos activos a los que pertenece el usuario y permite abrirlos.
- Un visitante autenticado puede ver foto, nombre, ciudad, descripción, capitán y plantilla.
- Un visitante no puede obtener `invite_code`, precio ni configuración interna mediante las RPC públicas.
- Un visitante no puede ver partidos privados del equipo.
- Un miembro no puede editar, invitar, expulsar ni eliminar.
- Los avisos de eliminación usan «partidos».
- `npx expo lint`, `npx tsc --noEmit`, `npm test` y `git diff --check` pasan.
- Las RPC se prueban con capitán, miembro y usuario externo, y se ejecutan los advisors de Supabase.

No se incluye automatización, cron ni notificaciones de la Fase 2.
