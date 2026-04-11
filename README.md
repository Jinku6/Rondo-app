# Rondo ⚽

Rondo es una plataforma profesional diseñada para organizar y encontrar partidos de fútbol de manera rápida, segura y transparente. Nuestra misión es eliminar la fricción en la organización de partidos amateur, priorizando la velocidad de acción y la confianza entre jugadores.

## 🚀 Filosofía de Diseño
Nos basamos en tres pilares fundamentales:
1. **Velocidad sobre Estética**: Acciones inmediatas para crear o unirse a un partido en pasos mínimos.
2. **Claridad Inmediata**: Toda la información crítica (ubicación, cupos, nivel) es visible sin interacciones innecesarias.
3. **Confianza Visual**: Visibilidad total de la asistencia y actitud de los jugadores para garantizar partidos de calidad.

## ✨ Características Principales

### 🏟️ Organización de Partidos
- **Creación Rápida**: Define ubicación (integrado con mapas), fecha, hora y nivel del partido en segundos.
- **Gestión de Posiciones**: Filtra y especifica las posiciones necesarias para completar tu equipo.
- **Geolocalización**: Búsqueda inteligente de partidos por ciudad y radio de cercanía.

### 🤝 Sistema de Confianza (Trust Score)
- **Porcentaje de Asistencia**: Indicadores visuales de fiabilidad (Verde >85%, Ámbar 60-85%, Rojo <60%).
- **Calificaciones de Actitud**: Feedback post-partido para premiar el buen comportamiento y la puntualidad.
- **Perfiles Detallados**: Nivel de juego, etiquetas de jugador "fiable" y estadísticas históricas.

### 💬 Comunicación Directa
- **Chat por Partido**: Espacios privados para coordinar con todos los asistentes confirmados.
- **Contacto con Organizador**: Canal directo para resolver dudas rápidas antes de unirse.
- **Notificaciones Real-time**: Alertas sobre nuevos partidos y cambios de estado en tus reservas.

### 🔒 Privacidad y Seguridad
- **Protección de Datos**: Los números de teléfono solo son visibles para el organizador y compañeros confirmados mediante políticas de *Row Level Security* (RLS).
- **Control de Acceso**: Sistema robusto de autenticación para asegurar la integridad de la comunidad.

## 🛠️ Stack Tecnológico

- **Frontend**: [React Native](https://reactnative.dev/) con [Expo SDK](https://expo.dev/).
- **Enrutamiento**: [Expo Router](https://docs.expo.dev/router/introduction/) para navegación basada en archivos.
- **Estilos**: [NativeWind](https://www.nativewind.dev/) (Tailwind CSS para React Native) siguiendo el manual de estilo propio.
- **Backend as a Service**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Edge Functions, Storage).
- **Validación**: [Zod](https://zod.dev/) para esquemas de datos robustos y seguros.
- **Automatización**: *Supabase pg_cron* para la finalización automática de partidos y gestión de estados.

## 📦 Configuración del Proyecto

### Requisitos Previos
- Node.js (v18 o superior)
- Expo Go en tu dispositivo móvil o emulador configurado.

### Instalación
1. Clona el repositorio:
   ```bash
   git clone [url-del-repo]
   cd futbol
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura las variables de entorno:
   Crea un archivo `.env` en la raíz con tus credenciales de Supabase:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=tu_url_aqui
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu_key_aqui
   ```
4. Inicia la aplicación:
   ```bash
   npx expo start
   ```

## 🎨 Sistema de Estilos
El proyecto sigue estrictamente las guías definidas en [`estilos.md`](./estilos.md).
- **Color Primario**: Green 500 (#22C55E)
- **Fondos**: Dark Mode (#0A0A0A / #111827)
- **Tipografía**: Inter (Weights: 400, 500, 600, 700)

---
Desarrollado con ❤️ para la comunidad futbolera.
