import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buscarCiudad, GeoResult } from '@/lib/geocoding';

interface Props {
  value: string;
  onSelect: (resultado: GeoResult) => void;
  onClear: () => void;
  // Para inyectar la ubicación GPS desde el padre sin pasar por el dropdown
  presetResult?: GeoResult | null;
}

export function CiudadInput({ value, onSelect, onClear, presetResult }: Props) {
  const [query, setQuery] = useState(value);
  const [resultados, setResultados] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [bloqueado, setBloqueado] = useState(!!value);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cuando el padre inyecta un resultado GPS, actualizamos el estado interno
  useEffect(() => {
    if (presetResult) {
      setQuery(presetResult.ciudad);
      setResultados([]);
      setBloqueado(true);
    }
  }, [presetResult]);

  // Sincronizar query con el prop value cuando cambia externamente
  // (p. ej. cuando el padre limpia la ciudad o la restablece tras un re-mount)
  useEffect(() => {
    if (value !== query) {
      setQuery(value);
      setBloqueado(!!value);
      setResultados([]);
    }
  // Solo queremos reaccionar a cambios del padre, no a cada pulsación del usuario
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    setBloqueado(false); // el usuario está editando → ya no hay selección válida

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (text.length < 2) { setResultados([]); return; }

    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await buscarCiudad(text);
        setResultados(res);
      } catch {
        setResultados([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  const handleSelect = (resultado: GeoResult) => {
    setQuery(resultado.ciudad);
    setResultados([]);
    setBloqueado(true);
    onSelect(resultado);
  };

  const handleClear = () => {
    setQuery('');
    setResultados([]);
    setBloqueado(false);
    onClear();
  };

  return (
    <View style={{ minHeight: 36 }}>
      {/* Input row — sin bordes propios, encaja en el contenedor padre */}
      <View className="flex-row items-center flex-1" style={{ minHeight: 36 }}>
        {loading
          ? <ActivityIndicator size="small" color="#22C55E" style={{ marginRight: 4 }} />
          : <Ionicons name="location-outline" size={24} color={bloqueado ? '#22C55E' : '#94a3b8'} />
        }
        <TextInput
          className="flex-1 ml-4 text-slate-900 dark:text-white text-lg font-medium"
          placeholder="¿En qué ciudad?"
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={handleChange}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={20} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Dropdown inline */}
      {resultados.length > 0 && (
        <View className="mt-2 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
          {resultados.map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => handleSelect(item)}
              className={`px-4 py-3 flex-row items-center ${i < resultados.length - 1 ? 'border-b border-slate-100 dark:border-gray-800' : ''}`}
            >
              <Ionicons name="location-outline" size={16} color="#22C55E" style={{ marginRight: 8 }} />
              <Text className="text-base font-medium text-slate-800 dark:text-white">
                {item.ciudad}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Hint cuando no está bloqueado y hay texto */}
      {!bloqueado && query.length >= 2 && resultados.length === 0 && !loading && (
        <Text className="text-xs text-amber-600 dark:text-amber-400 mt-1 ml-1">
          Selecciona una ciudad del desplegable
        </Text>
      )}
    </View>
  );
}
