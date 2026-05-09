import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { buscarDireccion, resolverDireccion, GeoResult, GeoSuggestion } from '@/lib/geocoding';
import { VenueConfirmModal } from '@/components/VenueConfirmModal';
import {
  createManualVenue,
  reportVenueIssue,
  resolveExternalPlace,
} from '@/lib/location/locationService';
import type { ExistingVenueResolution, Venue } from '@/types/location';

interface Props {
  value: string;
  onSelect: (resultado: GeoResult) => void;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  createdBy?: string;
}

const DEFAULT_MANUAL_PIN = { latitude: 40.4168, longitude: -3.7038 };

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const earthRadiusMeters = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function isExistingVenueResolution(value: Venue | ExistingVenueResolution): value is ExistingVenueResolution {
  return 'kind' in value && value.kind === 'existing';
}

export function UbicacionInput({
  value,
  onSelect,
  onChangeText,
  placeholder = 'Busca el campo o direccion...',
  createdBy,
}: Props) {
  const [resultados, setResultados] = useState<GeoSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [seleccionado, setSeleccionado] = useState<GeoResult | null>(null);
  const [pendingResult, setPendingResult] = useState<GeoResult | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [resolving, setResolving] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sessionTokenRef = useRef(`rondo-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const resetSessionToken = () => {
    sessionTokenRef.current = `rondo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  };

  const handleChange = useCallback(
    (text: string) => {
      onChangeText?.(text);
      setSeleccionado(null);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (text.length < 3) {
        setResultados([]);
        return;
      }

      timeoutRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const res = await buscarDireccion(text, sessionTokenRef.current);
          setResultados(res);
        } catch {
          setResultados([]);
        } finally {
          setLoading(false);
        }
      }, 350);
    },
    [onChangeText]
  );

  const applySelection = (resultado: GeoResult) => {
    const label = [resultado.nombre, resultado.direccion, resultado.ciudad]
      .filter(Boolean)
      .join(', ');
    onChangeText?.(label);
    setResultados([]);
    setSeleccionado(resultado);
    onSelect(resultado);
  };

  const handleSelect = async (resultado: GeoSuggestion) => {
    setLoading(true);
    try {
      const resolved = await resolverDireccion(resultado, sessionTokenRef.current);
      if (!resolved) {
        Alert.alert('No se pudo encontrar la ubicacion', 'Prueba con otra busqueda o crea la ubicacion manualmente.');
        return;
      }
      setResultados([]);
      setPendingResult(resolved);
      setManualMode(false);
    } catch (error) {
      Alert.alert('No se pudo encontrar la ubicacion', error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleManual = async () => {
    const name = value.trim();
    if (name.length < 3) return;
    let initialPin = DEFAULT_MANUAL_PIN;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        initialPin = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
      }
    } catch {
      initialPin = DEFAULT_MANUAL_PIN;
    }
    setPendingResult({
      nombre: name,
      direccion: '',
      ciudad: '',
      lat: initialPin.latitude,
      lng: initialPin.longitude,
      source: 'manual',
      qualityStatus: 'user_adjusted',
    });
    setManualMode(true);
    resetSessionToken();
  };

  const handleConfirmLocation = async (confirmed: {
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    city: string;
  }) => {
    if (!pendingResult || resolving) return;
    setResolving(true);
    try {
      const adjusted =
        distanceMeters(
          { lat: pendingResult.lat, lng: pendingResult.lng },
          { lat: confirmed.latitude, lng: confirmed.longitude }
        ) > 10;

      if (pendingResult.source === 'external' && pendingResult.externalPlace && createdBy) {
        const resolved = await resolveExternalPlace({
          externalPlace: pendingResult.externalPlace,
          createdBy,
        });
        const venue = isExistingVenueResolution(resolved) ? resolved.venue : resolved;
        applySelection({
          nombre: venue.canonical_name,
          direccion: venue.address || pendingResult.direccion,
          ciudad: confirmed.city || venue.city,
          lat: confirmed.latitude,
          lng: confirmed.longitude,
          venueId: venue.id,
          source: 'external',
          qualityStatus: adjusted ? 'user_adjusted' : 'external_unverified',
        });
      } else if (manualMode && createdBy) {
        const resolved = await createManualVenue({
          name: confirmed.name,
          city: confirmed.city,
          address: confirmed.address || undefined,
          latitude: confirmed.latitude,
          longitude: confirmed.longitude,
          createdBy,
        });
        const venue = isExistingVenueResolution(resolved) ? resolved.venue : resolved;
        applySelection({
          nombre: venue.canonical_name,
          direccion: venue.address || confirmed.address || '',
          ciudad: confirmed.city || venue.city,
          lat: confirmed.latitude,
          lng: confirmed.longitude,
          venueId: venue.id,
          source: 'manual',
          qualityStatus: 'user_adjusted',
        });
      } else {
        if (pendingResult.venueId && adjusted && createdBy) {
          await reportVenueIssue({
            venueId: pendingResult.venueId,
            reportedBy: createdBy,
            reason: 'wrong_pin',
            suggestedLatitude: confirmed.latitude,
            suggestedLongitude: confirmed.longitude,
          });
        }

        applySelection({
          ...pendingResult,
          direccion: confirmed.address || pendingResult.direccion,
          ciudad: confirmed.city || pendingResult.ciudad,
          lat: confirmed.latitude,
          lng: confirmed.longitude,
          qualityStatus: adjusted ? 'user_adjusted' : pendingResult.qualityStatus || 'confirmed',
        });
      }

      setPendingResult(null);
      setManualMode(false);
      resetSessionToken();
    } catch (error) {
      Alert.alert('No se pudo confirmar la ubicacion', error instanceof Error ? error.message : String(error));
    } finally {
      setResolving(false);
    }
  };

  const handleClear = () => {
    onChangeText?.('');
    setResultados([]);
    setSeleccionado(null);
    resetSessionToken();
  };

  return (
    <View>
      <View className="flex-row items-center bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg px-3">
        <Ionicons name="location-outline" size={18} color="#22C55E" />
        <TextInput
          className="flex-1 py-3 px-2 text-slate-900 dark:text-white text-base"
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          value={value}
          onChangeText={handleChange}
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" color="#22C55E" />}
        {!loading && value.length > 0 && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {resultados.length > 0 && (
        <View className="mt-1 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg overflow-hidden">
          {resultados.map((item, i) => (
            <TouchableOpacity
              key={`${item.source}-${item.venueId || item.nombre}-${i}`}
              onPress={() => handleSelect(item)}
              className={`px-4 py-3 ${i < resultados.length - 1 ? 'border-b border-slate-100 dark:border-gray-800' : ''}`}
            >
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm font-medium text-slate-800 dark:text-white flex-1" numberOfLines={1}>
                  {item.nombre || item.direccion}
                </Text>
                <Text className="text-[10px] font-semibold text-green-600 dark:text-green-400">
                  {item.source === 'venue' ? 'Rondo' : 'Mapbox'}
                </Text>
              </View>
              {item.ciudad ? (
                <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.ciudad}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {value.trim().length >= 3 && !loading && (
        <TouchableOpacity
          onPress={handleManual}
          className="mt-2 border border-dashed border-slate-300 dark:border-gray-700 rounded-lg px-4 py-3"
        >
          <Text className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            No encuentro el campo
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Coloca el pin para crear una ubicacion nueva.
          </Text>
        </TouchableOpacity>
      )}

      {seleccionado && resultados.length === 0 && (
        <View className="flex-row items-center mt-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
          <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
          <Text className="text-xs text-green-700 dark:text-green-400 ml-1 flex-1" numberOfLines={1}>
            {seleccionado.ciudad} - {seleccionado.lat.toFixed(4)}, {seleccionado.lng.toFixed(4)}
          </Text>
        </View>
      )}

      {pendingResult && (
        <VenueConfirmModal
          visible={!!pendingResult}
          title={manualMode ? 'Busca el campo' : 'Confirma la ubicacion'}
          name={pendingResult.nombre}
          address={pendingResult.direccion}
          city={pendingResult.ciudad}
          latitude={pendingResult.lat}
          longitude={pendingResult.lng}
          editableName={manualMode}
          requireCity={manualMode}
          onCancel={() => {
            setPendingResult(null);
            setManualMode(false);
            resetSessionToken();
          }}
          onConfirm={handleConfirmLocation}
        />
      )}

      {resolving && (
        <View className="flex-row items-center mt-2">
          <ActivityIndicator size="small" color="#22C55E" />
          <Text className="text-xs text-slate-500 dark:text-slate-400 ml-2">Guardando ubicacion...</Text>
        </View>
      )}
    </View>
  );
}
