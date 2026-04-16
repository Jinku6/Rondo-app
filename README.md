# Rondo ⚽

**Organiza partidos sin perder la pelota.** Rondo es la plataforma que faltaba para encontrar a ese jugador que faltaba para el partido

Nuestra misión: **eliminar la fricción**, porque el fútbol ya es suficientemente complicado sin tener que estar persiguiendo a 22 jugadores por WhatsApp.

## 🚀 Filosofía de Diseño
Tres pilares que no negociamos:

1. **⚡ Velocidad sobre Estética**: Crea o únete a un partido en menos clics que lo que tarda en llegar una pelota desde media cancha.
2. **👀 Claridad Inmediata**: Toda la info que importa (dónde, cuándo, nivel, cupos) visible sin tener que hacer scroll de tu vida.
3. **🤝 Confianza Visual**: Ves quién falta, quién es de fiar y quién probablemente mande un "no puedo" a las 3 de la tarde.

## ✨ Características Principales

### 🏟️ Organización de Partidos
- **Creación Rápida** ⚡: Ubica el partido, elige fecha y hora, define el nivel. Ya tienes tu partido publicado en segundos.
- **Gestión de Posiciones**: Especifica si necesitas defensas, mediocampistas o alguien que sea capaz de marcar un gol (sin pedir milagros). Si cualquier jugador te vale, ¡también puedes ponerlo!
- **Geolocalización Inteligente**: Busca partidos por tu barrio y radio de cercanía. Nada de "quedamos en X" sin saber dónde es.

### 🤝 Sistema de Confianza (Trust Score)
El sistema que por fin te dice quién es confiable sin tener que adivinar:

- **Asistencia**: 
Hemos diseñado un sistema que evalúa la asistencia de los jugadores a los partidos, clasificándolos en:
  - ✅ **Nunca falta**: Es leyenda, va siempre.
  - 🌟 **Casi nunca falta**: El que avisa con tiempo que no va.
  - ⚠️ **Falta con frecuencia**: "Te dije que sí pero me quede dormido"
  - 🚫 **Falta casi siempre**: No te puedes fiar de este jugador.
  
- **Calificaciones de Actitud**: Feedback post-partido que premia a los que llegan puntual, tienen buen compañerismo, no pelean y se quedan a las cervezas de después.
- **Perfiles Detallados**: Nivel de juego, etiquetas y estadísticas que hablan por sí solas.

### 💬 Comunicación Directa
- **Contacto con Organizador**: Pregunta directamente sin incómodas rondas de mensajes.
- **Notificaciones Real-time**: Entérate al instante de nuevos partidos, cambios de planes o si alguien dijo que sí pero cambió de opinión.

### 🔒 Privacidad y Seguridad
- **Tus números protegidos**: Solo quien confirma ve tu teléfono (el organizador y tus compañeros). Nada de listas públicas.
- **Control de Acceso Robusto**: Autenticación fuerte para que solo vengan los que queres.

## 🛠️ Stack Tecnológico

Construido con herramientas que no dejan tirado:

- **Frontend**: [React Native](https://reactnative.dev/) + [Expo SDK](https://expo.dev/) — funciona en iOS y Android.
- **Enrutamiento**: [Expo Router](https://docs.expo.dev/router/introduction/) — navegación organizada como un esquema de juego.
- **Estilos**: [NativeWind](https://www.nativewind.dev/) (Tailwind para React Native) siguiendo nuestro manual propio.
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL + Auth + Edge Functions) — todo lo que necesitas sin excusas.
- **Validación**: [Zod](https://zod.dev/) — esquemas de datos que funcionan como una defensa organizada.
- **Automatización**: *Supabase pg_cron* — finaliza partidos y gestiona estados sin que tengas que hacer nada.

## 🎨 Sistema de Estilos
- **Color Primario**: Verde (#22C55E) — el del pasto, qué si no.
- **Fondos**: Dark Mode (#0A0A0A / #111827) — menos quemón en los ojos.
- **Tipografía**: Inter (Weights: 400, 500, 600, 700) — limpia y sin vueltas.

---

> ⚠️ **Proyecto privado** — Este repositorio no es open source. No está permitida su reproducción, distribución ni uso sin autorización expresa del autor.

**Desarrollado con ❤️ para los que aman jugar, no complicarse.**

*P.D.: Si tu Trust Score es rojo, empezá por llegar a tiempo.* ⚽