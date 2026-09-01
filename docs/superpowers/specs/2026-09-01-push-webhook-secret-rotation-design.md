# Rotación segura del webhook de notificaciones push

## Objetivo

Rotar `SEND_PUSH_WEBHOOK_SECRET` sin interrumpir los seis triggers que envían eventos desde Postgres a `send-push`, eliminar la credencial incrustada en `private.push_webhook_handler()` y verificar desde terminal el recorrido completo Postgres → `pg_net` → Edge Function.

## Estado confirmado

- `private.push_webhook_handler()` es `SECURITY DEFINER` y su secreto literal coincide con la huella del secreto configurado en Edge Functions.
- La función no usa Supabase Vault y no fija `search_path`.
- `anon`, `authenticated` y `service_role` no pueden ejecutarla directamente.
- Seis triggers internos dependen de ella: participantes (insert/update/delete), partidos (update), notificaciones (insert) y chat (insert).

## Enfoques evaluados

### 1. Rotación escalonada con doble secreto y Vault — elegido

La Edge Function acepta temporalmente el secreto vigente y un secreto siguiente. Postgres cambia después al secreto siguiente almacenado cifrado en Vault. Tras verificar el nuevo recorrido, el secreto siguiente pasa a ser el único secreto aceptado.

Ventajas: no hay ventana de indisponibilidad, la credencial antigua queda revocada y ningún valor secreto entra en Git, migraciones o salidas de terminal.

### 2. Sustitución inmediata

Cambiar Edge y Postgres de forma consecutiva deja una ventana en la que uno de los extremos usa una credencial diferente. Se descarta por riesgo de perder notificaciones.

### 3. Clave secreta general de Supabase

Autenticar el webhook con una clave `sb_secret_*` permitiría usar la autenticación nativa, pero esa clave puede saltarse RLS y tiene más privilegios que una credencial dedicada. Se descarta por no respetar mínimo privilegio.

## Diseño

### Autenticación temporal

`send-push` leerá:

- `SEND_PUSH_WEBHOOK_SECRET`: secreto primario.
- `SEND_PUSH_WEBHOOK_SECRET_NEXT`: secreto temporal de rotación.

La comparación será de tiempo constante y fallará con `401` si faltan credenciales o ninguna coincide. Los valores nunca se registrarán.

### Gestión de la credencial

El secreto nuevo se generará con un generador criptográfico y al menos 256 bits de entropía. Durante la operación vivirá únicamente en un archivo temporal fuera del repositorio, con alcance limitado a la rotación. El mismo valor se cargará en Edge Functions y en Supabase Vault con el nombre `send_push_webhook_secret`.

El archivo temporal se eliminará tras completar o abortar la rotación. No se leerán ni mostrarán valores existentes.

### Función de Postgres

Una migración reemplazará `private.push_webhook_handler()` conservando su firma y los seis triggers. La función:

- seguirá siendo `SECURITY DEFINER`;
- fijará `search_path TO pg_catalog`;
- obtendrá la credencial por nombre desde `vault.decrypted_secrets`;
- mantendrá la llamada asíncrona mediante `net.http_post`;
- no incluirá secretos literales;
- conservará revocados los permisos de `PUBLIC`, `anon`, `authenticated` y `service_role`.

Si Vault no contiene exactamente una credencial válida, la función omitirá la llamada HTTP y emitirá una advertencia sin incluir datos sensibles. Así el webhook falla cerrado —nunca envía una petición sin autenticar— pero una incidencia de notificaciones no bloquea la operación principal del usuario.

## Secuencia sin interrupción

1. Implementar y probar localmente la aceptación temporal de dos secretos.
2. Desplegar `send-push`; el secreto vigente continúa funcionando.
3. Copiar temporalmente el secreto anterior desde la propia definición SQL a Vault, identificándolo por su huella y sin devolver su valor. Se usará exclusivamente para demostrar su revocación.
4. Generar el secreto nuevo y cargarlo como `SEND_PUSH_WEBHOOK_SECRET_NEXT`.
5. Crear o actualizar `send_push_webhook_secret` en Vault con el mismo valor.
6. Aplicar la migración que hace que Postgres lea Vault.
7. Enviar desde Postgres un evento inocuo a través de `pg_net` y comprobar respuesta HTTP `200`.
8. Promover el valor nuevo a `SEND_PUSH_WEBHOOK_SECRET` y eliminar `SEND_PUSH_WEBHOOK_SECRET_NEXT`.
9. Desplegar la versión final que acepta solo el secreto primario.
10. Invocar la Edge Function desde Postgres con el secreto anterior temporal y comprobar `401`; repetir con el secreto nuevo y comprobar `200`.
11. Eliminar de Vault la copia temporal del secreto anterior.

Si falla cualquier verificación antes del paso 7, Edge seguirá aceptando el secreto anterior y se podrá restaurar la función de Postgres sin perder la vía de autenticación.

## Verificación

- Pruebas unitarias para secreto primario, secreto siguiente, secreto erróneo y configuración ausente.
- `npm test -- --maxWorkers=1`.
- `npm run lint`.
- `npx tsc --noEmit`.
- `git diff --check`.
- Confirmar que la definición de Postgres usa Vault, fija `search_path` y no contiene la huella antigua.
- Confirmar que los seis triggers siguen asociados.
- Confirmar que Vault contiene un único secreto con el nombre esperado, sin consultar su valor.
- Confirmar desde terminal una respuesta `200` con la ruta nueva y `401` con la credencial antigua.
- Revisar las últimas respuestas de `net._http_response`, los logs de Edge Functions y los asesores de seguridad/rendimiento.

## Fuera de alcance

- Cambiar el sistema general de claves Supabase.
- Modificar el contenido o destinatarios de las notificaciones.
- Rotar `CRON_SECRET` u otras credenciales no relacionadas.
