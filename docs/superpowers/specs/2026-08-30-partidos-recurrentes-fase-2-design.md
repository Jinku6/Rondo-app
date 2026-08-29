# Partidos recurrentes — Fase 2

## Objetivo

Permitir que el capitán convierta un partido privado del equipo en una recurrencia semanal o mensual desde el formulario normal de creación. Rondo mantendrá una única instancia futura por regla y generará la siguiente automáticamente, siempre a la hora local configurada en `Europe/Madrid`.

Esta fase también traslada la decisión de aprobación al momento de publicar plazas libres y corrige la jerarquía visual de los botones de creación.

## Decisiones de producto

- La recurrencia se configura al crear un partido del equipo, no al editar el equipo.
- Cada formulario crea como máximo una regla recurrente.
- Si un equipo juega dos veces por semana, el capitán crea dos recurrencias independientes.
- Solo se admiten frecuencias `weekly` y `monthly`.
- No existe selector de cantidad de partidos por periodo.
- La recurrencia no tiene fecha final: continúa hasta que el capitán la anula.
- Anular una recurrencia no cancela ni modifica partidos ya generados.
- Los cambios sobre una instancia concreta no alteran su recurrencia.
- En esta primera versión no se edita una regla: para cambiarla permanentemente se anula y se crea otra.

## Modelo conceptual

Se añadirá una entidad independiente de recurrencias vinculada a `match_series`. No se reutilizarán `automation_mode`, `day_of_week` y `start_time` como fuente principal porque esos campos solo permiten una configuración por equipo.

Cada recurrencia tendrá:

- Identificador propio.
- Equipo y capitán que la creó.
- Frecuencia semanal o mensual.
- Día de la semana.
- Semana del mes para recurrencias mensuales: primera, segunda, tercera, cuarta o última.
- Hora local.
- Zona horaria fija `Europe/Madrid`.
- Plantilla inmutable con los datos necesarios para crear futuros partidos: título, ubicación y venue, descripción, nivel, posiciones, colores, precio y demás campos admitidos por `create_team_match`.
- Referencia al primer partido creado.
- Estado activo o anulado y sus marcas temporales.

La implementación concretará columnas, constraints e índices después de volver a consultar el esquema real de Supabase. El SQL exacto se presentará al usuario antes de aplicarlo.

## Formulario de creación

El formulario existente `app/(tabs)/create.tsx` seguirá siendo la única superficie para crear partidos del equipo.

### Configuración

En partidos de equipo se elimina el selector `Requiere aprobación` y se sustituye por `Crear partido recurrente`.

Cuando esté desactivado, el flujo continuará creando un único partido privado.

Cuando esté activado:

- Se muestra un selector de frecuencia: `Semanal` o `Mensual`.
- Ambas frecuencias muestran el día de la semana.
- `Mensual` añade el selector de semana del mes.
- La hora se toma del campo de hora del partido y no se pide de nuevo.
- Si el capitán cambia el día recurrente, la fecha del primer partido avanza automáticamente hasta la próxima ocurrencia de ese día y conserva la hora.
- Se muestra un resumen legible, por ejemplo: `Se jugará el tercer jueves de cada mes a las 21:00. Seguirá activo hasta que lo anules.`

### Creación atómica

Una única operación autenticada crea:

1. El partido privado introducido en el formulario.
2. La recurrencia asociada cuando se haya activado.
3. Las participaciones de los miembros activos con `status='pending'`.

Si falla cualquier parte, la transacción completa se revierte. El formulario conserva los datos y permite reintentar.

### Botones

- `Crear partido privado` mantendrá el texto centrado con ancho, altura y alineación estables en pantallas pequeñas.
- `Crear partido` en la ficha del equipo tendrá borde verde de 2 puntos, fondo verde suave y contraste superior.
- Los controles táctiles tendrán al menos 48 puntos y estados visible de pulsación, carga y deshabilitado.

## Frecuencias

### Semanal

Genera una ocurrencia en el día seleccionado a la hora local del partido inicial.

Ejemplo: `Cada sábado · 21:00`.

### Mensual

Genera una ocurrencia según la combinación explícita de semana y día.

Ejemplo: `Tercer jueves de cada mes · 21:00`.

La opción `Última` significa la última aparición de ese día dentro del mes. No se ofrecerá `Quinta`, evitando reglas que no tengan ocurrencia en todos los meses.

## Generación automática

Un job diario de `pg_cron` ejecutará una función SQL interna. La función no necesita llamar a una Edge Function porque no envía pushes.

### Una sola instancia futura

Cada recurrencia mantendrá como máximo un partido futuro generado:

- El primer partido se crea junto a la regla.
- Mientras su fecha no haya pasado, el cron no crea el siguiente.
- Después de que pase la fecha programada, el siguiente job genera la próxima ocurrencia.
- El estado final del partido anterior no adelanta la generación: cancelar una instancia no crea inmediatamente la siguiente.
- Al anular la regla antes de que pase la instancia vigente, el próximo partido nunca llega a generarse.

### Idempotencia

La base de datos tendrá una restricción única real sobre recurrencia y fecha de ejecución. La función comprobará además si ya existe una instancia futura. Ejecutar el job varias veces producirá el mismo estado final.

### Zona horaria

Los cálculos parten siempre de fecha, día y hora locales en `Europe/Madrid` y después producen un `timestamptz`. No se sumarán intervalos UTC de siete o treinta días para calcular recurrencias.

## Visualización y anulación

La ficha del equipo mostrará `Partidos recurrentes` debajo de la plantilla y antes de la gestión general.

- Los miembros activos ven el nombre, el calendario y el próximo partido generado.
- El capitán ve además `Anular recurrencia`.
- Los visitantes externos no ven esta sección ni pueden consultar las reglas mediante la API.

La confirmación de anulación explicará el efecto con la fecha real de la instancia existente:

> El partido de este sábado sigue en pie. No se generarán los siguientes partidos de esta recurrencia.

La anulación desactiva la regla de forma permanente. No actualiza, cancela ni elimina ningún partido existente.

## Publicar plazas libres

Los partidos del equipo se crean siempre privados. `requires_approval` no se decide durante la creación privada.

Al pulsar `Publicar plazas libres`, una única hoja de confirmación obliga al capitán a elegir:

- `Entrada directa`: las nuevas altas públicas entran sin revisión.
- `Revisar solicitudes`: el capitán acepta o rechaza cada solicitud.

La operación de publicación recibe la elección y realiza atómicamente:

1. Establecer `requires_approval`.
2. Activar `recruiting_public`.
3. Liberar las reservas de miembros `pending` o `declined` según el comportamiento ya aprobado.
4. Conservar las confirmaciones `joined`.

La hoja recuerda que la publicación es irreversible. Una vez público, cualquier miembro que no confirmó deberá usar el mismo flujo de entrada o solicitud que el resto de usuarios de Rondo.

## Seguridad

- Crear o anular una recurrencia exige sesión autenticada y ser capitán del equipo.
- Leer recurrencias exige ser el capitán o un miembro activo.
- El job usa una función interna `SECURITY DEFINER` con `search_path` fijo y permisos mínimos.
- Las operaciones públicas autenticadas validan autorización dentro de la función, no confían en datos enviados por el cliente.
- Los visitantes externos no reciben la plantilla de configuración de una recurrencia.
- Los partidos privados siguen excluidos de consultas públicas mientras `recruiting_public=false`.
- No se modifica `auto_confirm_attendance()` ni el filtro `attended IS NOT NULL` de fiabilidad.
- Todos los miembros generados permanecen `pending` hasta responder.

## Errores y recuperación

- La creación revierte partido y recurrencia si falla cualquier inserción.
- La UI evita envíos dobles y muestra progreso durante operaciones asíncronas.
- Un error conserva el formulario para permitir reintento.
- Un cron reejecutado no duplica instancias.
- Una regla anulada entre la lectura y la escritura no puede generar otro partido; la función vuelve a comprobar su estado dentro de la transacción.
- Los mensajes explican la causa y el siguiente paso, sin mostrar objetos de error sin formatear.

## Pruebas bloqueantes

### Recurrencia

- Generación semanal en cada día admitido.
- Primera, segunda, tercera, cuarta y última aparición mensual.
- Meses de diferente longitud y años bisiestos.
- Cambio horario de marzo manteniendo la hora local.
- Cambio horario de octubre manteniendo la hora local.
- Una sola instancia futura por regla.
- Ejecuciones repetidas sin duplicados.
- Cancelar una instancia no adelanta la siguiente.
- Anular una regla conserva la instancia vigente y bloquea la siguiente.
- Dos recurrencias independientes en el mismo equipo.

### Participantes y privacidad

- Miembros creados como `pending`.
- Un `pending` no adquiere `attended` ni afecta a fiabilidad.
- Capitán y miembros activos pueden leer la recurrencia.
- Usuario externo no puede leerla, anularla ni generar instancias.
- Partido privado ausente de listados generales, `partidos_cerca` y `nearby_digest`.

### Publicación

- Entrada directa establece `requires_approval=false`.
- Revisión establece `requires_approval=true`.
- Ambas opciones activan el mismo estado público final.
- `pending` y `declined` pierden la reserva; `joined` la conserva.
- Tras publicar, un miembro no confirmado sigue el flujo público normal.

### Interfaz

- Controles condicionales correctos para semanal y mensual.
- Cambio de día sincroniza la primera fecha y conserva la hora.
- Resumen de recurrencia correcto antes de guardar.
- Texto de `Crear partido privado` centrado en teléfono pequeño.
- Botón de la ficha con borde verde visible en temas soportados.
- Estados de carga, deshabilitado y etiquetas de accesibilidad.

## Despliegue

1. Consultar de nuevo esquema, funciones, grants, RLS y jobs reales mediante Supabase MCP.
2. Presentar el SQL completo sin aplicarlo.
3. Tras aprobación, aplicar tablas, funciones y políticas sin programar todavía el cron.
4. Ejecutar pruebas SQL, de seguridad y DST.
5. Implementar y validar el cliente.
6. Mostrar el SQL exacto de `cron.schedule` y activarlo solo tras una confirmación separada.
7. Validar en dispositivo real antes de declarar terminada la fase.

## Fuera de alcance

- Frecuencias distintas de semanal y mensual.
- Más de una ocurrencia dentro de una misma regla.
- Fecha final o número máximo de partidos.
- Edición de una recurrencia existente.
- Publicación automática por falta de jugadores.
- Deadline automático de confirmación.
- Recordatorios push nuevos.
- Chat persistente del equipo.
- Cambios en fiabilidad o asistencia automática.
