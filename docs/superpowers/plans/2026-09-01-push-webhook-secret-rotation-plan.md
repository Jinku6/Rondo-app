# Plan de implementación: rotación segura del webhook push

## Objetivo verificable

Completar una rotación sin interrupción en la que `private.push_webhook_handler()` deje de contener credenciales literales, lea un secreto dedicado desde Vault y solo el secreto nuevo autentique llamadas a `send-push` al finalizar.

## 1. Autenticación temporal de doble secreto

Archivos:

- Crear `supabase/functions/_shared/webhookAuth.ts`.
- Modificar `supabase/functions/send-push/index.ts`.
- Crear `test/security/webhookAuth.test.ts`.

Cambios:

- Implementar una comparación de contenido en tiempo constante.
- Aceptar `SEND_PUSH_WEBHOOK_SECRET` y, si existe, `SEND_PUSH_WEBHOOK_SECRET_NEXT`.
- No registrar cabeceras ni valores secretos.
- Mantener `401` ante secreto ausente o incorrecto.

Verificación:

- Probar secreto primario, siguiente, erróneo, vacío y listas sin configurar.
- Ejecutar la prueba específica, lint y TypeScript.

## 2. Migración de Postgres a Vault

Archivos:

- Crear la migración mediante `npx supabase migration new secure_push_webhook_secret`.
- Ampliar las pruebas de contrato de seguridad.

La migración reemplazará únicamente `private.push_webhook_handler()` y sus permisos. Mantendrá el payload y la URL actuales, fijará `search_path TO pg_catalog`, leerá `send_push_webhook_secret` desde `vault.decrypted_secrets`, omitirá de forma segura el envío si la configuración falta y capturará errores de `pg_net` sin bloquear la operación principal.

Verificación:

- La migración no contiene literales con la huella del secreto anterior.
- La función referencia Vault, `net.http_post` y los nombres de cabecera esperados.
- Se revoca ejecución a `PUBLIC`, `anon`, `authenticated` y `service_role`.
- Los seis triggers existentes no se recrean ni se modifican.

## 3. Validación local y commits

- Ejecutar `npm test -- --maxWorkers=1`.
- Ejecutar `npm run lint`.
- Ejecutar `npx tsc --noEmit`.
- Ejecutar `git diff --check`.
- Crear commits lógicos para documentación e implementación.

## 4. Puerta de aprobación

Mostrar antes de producción:

- SQL exacto de la migración.
- SQL operativo que conserva temporalmente el secreto anterior por su huella, sin devolverlo.
- Secuencia de despliegue y rollback.

Esperar aprobación explícita.

## 5. Rotación sin interrupción

1. Desplegar `send-push` con soporte temporal para dos secretos.
2. Generar 32 bytes aleatorios en memoria del proceso orquestador.
3. Guardar el secreto anterior temporalmente en Vault por comparación de huella, sin leerlo ni devolverlo.
4. Configurar el nuevo valor como `SEND_PUSH_WEBHOOK_SECRET_NEXT`.
5. Crear o actualizar `send_push_webhook_secret` en Vault con el nuevo valor.
6. Invocar `send-push` con el nuevo valor y un payload inocuo; exigir HTTP `200`.
7. Aplicar la migración aprobada.
8. Invocar desde Postgres mediante `net.http_post` usando Vault; exigir HTTP `200`.
9. Promover el nuevo valor a `SEND_PUSH_WEBHOOK_SECRET` y eliminar `SEND_PUSH_WEBHOOK_SECRET_NEXT`.
10. Comprobar mediante `pg_net` que el secreto anterior devuelve `401` y el nuevo `200`.
11. Eliminar la copia temporal del secreto anterior.

Si cualquier paso anterior a la promoción falla, mantener ambos secretos aceptados y restaurar la función previa o volver a apuntarla al secreto temporal anterior almacenado en Vault.

## 6. Verificación final desde terminal

- Edge Function `send-push` activa.
- Vault contiene `send_push_webhook_secret` y no contiene la copia `previous`.
- Definición SQL con `search_path`, referencia a Vault y sin secreto literal anterior.
- Seis triggers siguen asociados a la función.
- Secreto anterior: `401`.
- Secreto nuevo: `200` con `{ "record": null }` y tipo `participant_insert`.
- Últimas respuestas de `pg_net` sin errores inesperados.
- Asesores de Supabase revisados.
- Árbol Git limpio y migración local alineada con la versión remota.
