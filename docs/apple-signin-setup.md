# Sign in with Apple setup

Estos pasos son manuales y no se pueden completar solo desde el codebase.

## Apple Developer Portal

1. Entra en Certificates, Identifiers & Profiles.
2. Ve a Identifiers y selecciona el App ID de Rondo.
3. Activa la capability Sign In with Apple.
4. Guarda los cambios.

## EAS credentials

Regenera el provisioning profile de iOS para que incluya el entitlement nuevo:

```bash
eas credentials
```

Selecciona iOS, luego production, y regenera el provisioning profile.

## Supabase Dashboard

1. Entra en Authentication, luego Providers, luego Apple.
2. Activa Apple.
3. En la seccion "For iOS, iPadOS, macOS, watchOS, and tvOS", anade este Client ID:

```text
com.jinku620.rondo
```

4. No hace falta configurar Services ID, Team ID ni Private Key para este flujo nativo de iOS. Eso aplica al flujo web/OAuth en navegador.
5. Guarda los cambios.

## Build y submit

```bash
eas build --platform ios --profile production
eas submit --platform ios
```

## Texto sugerido para App Review

> We have added Sign in with Apple as an equivalent login option alongside Google Sign-In. Both options are available on the login and registration screens with equal visual prominence. The implementation uses the native Sign in with Apple flow via `expo-apple-authentication` and complies with Apple's Human Interface Guidelines.

## Testing recomendado

1. Probar en dispositivo fisico iOS con una build EAS.
2. Probar el primer login completo y confirmar que el nombre se guarda en `users.full_name`.
3. Cerrar sesion y probar un segundo login. Apple no volvera a devolver el nombre, pero el acceso debe funcionar igual.
4. Para repetir el primer flujo: iOS Settings, Apple ID, Sign in with Apple, Rondo, Stop Using Apple ID.
5. Probar Hide My Email y confirmar que el relay `@privaterelay.appleid.com` crea la cuenta correctamente.
6. Cancelar el modal de Apple y confirmar que no aparece ninguna alerta de error.
7. Verificar Android: el boton de Apple no debe renderizarse.
