# Universal links for shared matches

Shared matches use this URL shape:

```text
https://rondofc.app/match/{matchId}
```

When the app is installed, iOS and Android can open that URL directly in Rondo. When it is not installed, `rondofc.app` must handle the web request and show a download fallback.

## Domain files

Serve these files from the domain without redirects.

### iOS

Path:

```text
https://rondofc.app/.well-known/apple-app-site-association
```

Template:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "APPLE_TEAM_ID.com.jinku620.rondo",
        "paths": ["/match/*"]
      }
    ]
  }
}
```

Replace `APPLE_TEAM_ID` with the Apple Developer Team ID.

### Android

Path:

```text
https://rondofc.app/.well-known/assetlinks.json
```

Template:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.jinku620.rondo",
      "sha256_cert_fingerprints": [
        "ANDROID_SIGNING_CERT_SHA256"
      ]
    }
  }
]
```

Replace `ANDROID_SIGNING_CERT_SHA256` with the SHA-256 fingerprint of the signing certificate used for the production Android build.

## Fallback

If the app is not installed, the browser opens `https://rondofc.app/match/{matchId}`. That page should link to the App Store and Google Play, or redirect by platform once the store URLs are available.
