import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { buscarDireccion, GeoResult } from '@/lib/geocoding';

interface Props {
  value: string;
  onSelect: (resultado: GeoResult) => void;
  onChangeText?: (text: string) => void;
  placeholder?: string;
}

export function UbicacionInput({
  value,
  onSelect,
  onChangeText,
  placeholder = 'Busca el campo o dirección...',
}: Props) {
  const [resultados, setResultados] = useState<GeoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [seleccionado, setSeleccionado] = useState<GeoResult | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
        const res = await buscarDireccion(text);
        setResultados(res);
        setLoading(false);
      }, 350);
    },
    [onChangeText]
  );

  const handleSelect = (resultado: GeoResult) => {
    const label = [resultado.nombre, resultado.direccion, resultado.ciudad]
      .filter(Boolean)
      .join(', ');
    onChangeText?.(label);
    setResultados([]);
    setSeleccionado(resultado);
    onSelect(resultado);
  };

  const handleClear = () => {
    onChangeText?.('');
    setResultados([]);
    setSeleccionado(null);
  };

  return (
    <View>
      {/* Input row */}
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

      {/* Suggestions list (inline, not absolute) */}
      {resultados.length > 0 && (
        <View className="mt-1 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg overflow-hidden">
          {resultados.map((item, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => handleSelect(item)}
              className={`px-4 py-3 ${i < resultados.length - 1 ? 'border-b border-slate-100 dark:border-gray-800' : ''}`}
            >
              <Text className="text-sm font-medium text-slate-800 dark:text-white" numberOfLines={1}>
                {item.nombre || item.direccion}
              </Text>
              {item.ciudad ? (
                <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {item.ciudad}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Confirmation chip */}
      {seleccionado && resultados.length === 0 && (
        <View className="flex-row items-center mt-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2">
          <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
          <Text className="text-xs text-green-700 dark:text-green-400 ml-1 flex-1" numberOfLines={1}>
            {seleccionado.ciudad} · {seleccionado.lat.toFixed(4)}, {seleccionado.lng.toFixed(4)}
          </Text>
        </View>
      )}
    </View>
  );
}
