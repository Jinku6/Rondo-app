const PHOTON_URL = 'https://photon.komoot.io/api/';
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const HEADERS = { 'User-Agent': 'RondoApp/1.0 (contacto@rondo.app)' };
const FETCH_TIMEOUT_MS = 8000;
const MAX_QUERY_LENGTH = 100;

// Valida que lat/lng estén dentro de rangos geográficos válidos
function isValidCoords(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

// Fetch con timeout para evitar cuelgues indefinidos en APIs externas
function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

// Convierte coordenadas GPS en el nombre de la ciudad más cercana
export async function reverseGeocodeCiudad(lat: number, lng: number): Promise<GeoResult | null> {
  if (!isValidCoords(lat, lng)) return null;
  try {
    const url = `${NOMINATIM_REVERSE}?lat=${lat}&lon=${lng}&format=json&accept-language=es&zoom=10`;
    const res = await fetchWithTimeout(url, { headers: HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const ciudad = a.city || a.town || a.village || a.municipality || a.county || '';
    if (!ciudad) return null;
    const parsedLat = parseFloat(data.lat);
    const parsedLng = parseFloat(data.lon);
    if (!isValidCoords(parsedLat, parsedLng)) return null;
    return {
      nombre: ciudad,
      direccion: '',
      ciudad,
      lat: parsedLat,
      lng: parsedLng,
    };
  } catch {
    return null;
  }
}

export interface GeoResult {
  nombre: string;
  direccion: string;
  ciudad: string;
  lat: number;
  lng: number;
}

// Busca direcciones/campos concretos dentro de España
// IMPORTANTE: lang=es causa HTTP 400 en Photon — no incluirlo
export async function buscarDireccion(query: string): Promise<GeoResult[]> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (trimmed.length < 3) return [];

  const url =
    `${PHOTON_URL}?q=${encodeURIComponent(trimmed)}` +
    `&limit=6&bbox=-9.3,35.9,4.3,43.8`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json();

    return (data.features || []).map((f: any) => ({
      nombre: f.properties.name || '',
      direccion: [f.properties.street, f.properties.housenumber, f.properties.postcode]
        .filter(Boolean)
        .join(', '),
      ciudad:
        f.properties.city ||
        f.properties.town ||
        f.properties.village ||
        f.properties.municipality ||
        f.properties.county ||
        '',
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
  } catch {
    return [];
  }
}

// Busca ciudades/municipios de España
// Usa osm_tag nativo de Photon para filtrar solo entidades de tipo place
// IMPORTANTE: lang=es causa HTTP 400 en Photon — no incluirlo
export async function buscarCiudad(query: string): Promise<GeoResult[]> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (trimmed.length < 2) return [];

  const url =
    `${PHOTON_URL}?q=${encodeURIComponent(trimmed)}` +
    `&limit=8&bbox=-9.3,35.9,4.3,43.8` +
    `&osm_tag=place:city` +
    `&osm_tag=place:town` +
    `&osm_tag=place:village` +
    `&osm_tag=place:municipality`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json();

    const seen = new Set<string>();
    const results: GeoResult[] = [];

    for (const f of data.features || []) {
      const nombre = f.properties.name || '';
      if (!nombre || seen.has(nombre.toLowerCase())) continue;
      seen.add(nombre.toLowerCase());

      results.push({
        nombre,
        direccion: '',
        ciudad: nombre,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
      });
    }

    return results;
  } catch {
    return [];
  }
}
