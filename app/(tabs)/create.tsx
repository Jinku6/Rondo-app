import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Switch, ActivityIndicator, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { z } from 'zod';
import type { MatchLevel, PositionKey } from '@/types/database';
import { containsProfanity } from '@/lib/profanityFilter';
import { UbicacionInput } from '@/components/UbicacionInput';
import type { GeoResult } from '@/lib/geocoding';
import { isValidHexColor } from '@/lib/utils';

const CreateMatchSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
  location: z.string().min(3, 'La ubicación debe tener al menos 3 caracteres'),
  dateText: z.string().min(1, 'Debes indicar la fecha del partido'),
  timeText: z.string().min(1, 'Debes indicar la hora del partido'),
  totalPlayers: z.number().min(1, 'Debes solicitar al menos 1 jugador en las posiciones'),
  price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, 'El precio no es válido'),
});

const LEVELS = [
  { key: 'tranquilo', label: 'Tranquilo', emoji: '😌', color: 'bg-green-100 border-green-400', activeColor: 'bg-green-500 border-green-500', text: 'text-green-700', activeText: 'text-white' },
  { key: 'medio', label: 'Medio', emoji: '⚽', color: 'bg-amber-100 border-amber-400', activeColor: 'bg-amber-500 border-amber-500', text: 'text-amber-700', activeText: 'text-white' },
  { key: 'competitivo', label: 'Competitivo', emoji: '🔥', color: 'bg-red-100 border-red-400', activeColor: 'bg-red-500 border-red-500', text: 'text-red-700', activeText: 'text-white' },
];

export default function CreateMatchScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationCity, setLocationCity] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<MatchLevel>('medio');

  // Fecha y Hora
  const [dateObj, setDateObj] = useState(new Date());
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Posiciones
  const [positions, setPositions] = useState({
    portero: 0,
    defensa: 0,
    mediocentro: 0,
    delantero: 0,
    cualquiera: 0,
  });

  // Colores de equipo
  const [teamAColor, setTeamAColor] = useState('#EF4444');
  const [teamBColor, setTeamBColor] = useState('#3B82F6');
  const presetColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#111827', '#FFFFFF'];

  const [price, setPrice] = useState('0');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto-formateo de Fecha (DD/MM/YYYY)
  const handleDateChangeText = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    if (cleaned.length > 4) formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4) + '/' + cleaned.slice(4, 8);
    setDateText(formatted);
  };

  // Auto-formateo de Hora (HH:MM)
  const handleTimeChangeText = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = cleaned.slice(0, 2) + ':' + cleaned.slice(2, 4);
    setTimeText(formatted);
  };

  const handleTimeBlur = () => {
    let t = timeText.replace(/[^0-9]/g, '');
    if (t.length === 0) return;
    if (t.length <= 2) {
      setTimeText(t.padStart(2, '0') + ':00');
    } else if (t.length === 3) {
      setTimeText(t.slice(0, 1) + ':' + t.slice(1));
    } else {
      setTimeText(t.slice(0, 2) + ':' + t.slice(2, 4));
    }
  };

  const onDatePickerChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDateObj(selectedDate);
      if (Platform.OS === 'android') {
        const d = selectedDate;
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        setDateText(`${dd}/${mm}/${yyyy}`);
      }
    }
  };

  const confirmDateIOS = () => {
    setShowDatePicker(false);
    const d = dateObj;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    setDateText(`${dd}/${mm}/${yyyy}`);
  };

  const onTimePickerChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
    }
    if (selectedDate) {
      setDateObj(selectedDate);
      if (Platform.OS === 'android') {
        const h = String(selectedDate.getHours()).padStart(2, '0');
        const m = String(selectedDate.getMinutes()).padStart(2, '0');
        setTimeText(`${h}:${m}`);
      }
    }
  };

  const confirmTimeIOS = () => {
    setShowTimePicker(false);
    const h = String(dateObj.getHours()).padStart(2, '0');
    const m = String(dateObj.getMinutes()).padStart(2, '0');
    setTimeText(`${h}:${m}`);
  };

  const validateAndParseDateTime = () => {
    if (!dateText || !timeText) return null;
    const timeForParsing = timeText.includes(':') ? timeText : timeText + ':00';
    const [day, month, year] = dateText.split('/');
    const [hours, minutes] = timeForParsing.split(':');
    if (!day || !month || !year || year.length !== 4) return null;
    if (!hours || !minutes) return null;
    const dt = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(minutes));
    if (isNaN(dt.getTime())) return null;
    return dt;
  };

  async function handleCreate() {
    const currentTotal = Object.values(positions).reduce((a, b) => a + b, 0);

    try {
      CreateMatchSchema.parse({
        title,
        location,
        dateText,
        timeText,
        totalPlayers: currentTotal,
        price,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        Alert.alert('Error de validación', err.issues[0].message);
        return;
      }
    }

    const finalDateObj = validateAndParseDateTime();
    if (!finalDateObj) {
      Alert.alert('Error', 'La fecha u hora tienen un formato incorrecto. Usa DD/MM/YYYY y HH:MM.');
      return;
    }
    if (!user) {
      Alert.alert('Error', 'No estás autenticado');
      return;
    }

    if (!locationLat || !locationLng || !locationCity) {
      Alert.alert('Ubicación sin geolocalizar', 'Selecciona la ubicación desde el desplegable de sugerencias para que los jugadores puedan encontrarte en el mapa.');
      return;
    }

    if (containsProfanity(title) || containsProfanity(description) || containsProfanity(location)) {
      Alert.alert('Vocabulario no permitido', 'Por favor, utiliza palabras respetuosas en el título, ubicación y descripción.');
      return;
    }

    if (!isValidHexColor(teamAColor) || !isValidHexColor(teamBColor)) {
      Alert.alert('Color inválido', 'Los colores de equipo deben ser valores hexadecimales válidos.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('matches')
        .insert({
          organizer_id: user.id,
          title,
          location,
          location_lat: locationLat,
          location_lng: locationLng,
          location_city: locationCity,
          description,
          level,
          date_time: finalDateObj.toISOString(),
          requested_positions: positions,
          team_a_color: teamAColor,
          team_b_color: teamBColor,
          price_per_player: parseFloat(price) || 0,
          requires_approval: requiresApproval,
          status: 'open'
        })
        .select()
        .single();

      if (error) throw error;

      Alert.alert('¡Listo!', 'El partido ya está publicado en Rondo.', [
        { text: 'Ver partido', onPress: () => router.push(`/match/${data.id}`) },
        { text: 'Ir al inicio', onPress: () => router.push('/(tabs)') },
      ]);

      setTitle('');
      setLocation('');
      setLocationLat(null);
      setLocationLng(null);
      setLocationCity(null);
      setDescription('');
      setLevel('medio');
      setDateText('');
      setTimeText('');
      setPositions({ portero: 0, defensa: 0, mediocentro: 0, delantero: 0, cualquiera: 0 });

    } catch (e) {
      Alert.alert('Error al crear el partido', e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const updatePosition = (pos: PositionKey, increment: number) => {
    setPositions(prev => {
      const newVal = prev[pos] + increment;
      return { ...prev, [pos]: newVal < 0 ? 0 : newVal };
    });
  };

  const totalPlayers = Object.values(positions).reduce((a, b) => a + b, 0);

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-neutral-950" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView className="flex-1 bg-slate-50 dark:bg-neutral-950 p-4" keyboardShouldPersistTaps="handled">
        <Text className="text-3xl font-bold text-slate-900 dark:text-white mb-6">Crear Partido</Text>
        <View className="space-y-5 mb-10">

        {/* Información General */}
        <View className="bg-slate-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
          <Text className="text-slate-700 dark:text-slate-300 font-bold mb-3 text-lg">Información General</Text>
          <View className="mb-4">
            <Text className="text-slate-600 dark:text-slate-400 font-medium mb-1">Título del Partido</Text>
            <TextInput
              className="w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-3 text-slate-900 dark:text-white"
              placeholder="Fútbol-7 Jueves Tarde"
              placeholderTextColor="#9ca3af"
              value={title}
              onChangeText={setTitle}
            />
          </View>
          <View className="mb-4">
            <Text className="text-slate-600 dark:text-slate-400 font-medium mb-1">Ubicación</Text>
            <UbicacionInput
              value={location}
              onChangeText={setLocation}
              onSelect={(r: GeoResult) => {
                const label = [r.nombre, r.direccion, r.ciudad].filter(Boolean).join(', ');
                setLocation(label);
                setLocationLat(r.lat);
                setLocationLng(r.lng);
                setLocationCity(r.ciudad);
              }}
            />
          </View>
          <View>
            <Text className="text-slate-600 dark:text-slate-400 font-medium mb-1">Descripción</Text>
            <TextInput
              className="w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-3 text-slate-900 dark:text-white"
              placeholder="Buen ambiente, nivel medio, cervezas después de jugar"
              placeholderTextColor="#9ca3af"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Nivel del partido */}
        <View className="bg-slate-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
          <Text className="text-slate-700 dark:text-slate-300 font-bold mb-3 text-lg">Nivel del Partido</Text>
          <View className="flex-row gap-2">
            {LEVELS.map(l => {
              const isActive = level === l.key;
              return (
                <TouchableOpacity
                  key={l.key}
                  onPress={() => setLevel(l.key as MatchLevel)}
                  className={`flex-1 py-3 rounded-xl border-2 items-center ${isActive ? l.activeColor : l.color}`}
                >
                  <Text className="text-xl mb-1">{l.emoji}</Text>
                  <Text className={`font-bold text-sm ${isActive ? l.activeText : l.text}`}>{l.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Fecha y Hora */}
        <View className="bg-slate-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
          <Text className="text-slate-700 dark:text-slate-300 font-bold mb-3 text-lg">Cuándo jugamos</Text>
          <View className="flex-row space-x-3">
            <View className="flex-1 mr-2">
              <Text className="text-slate-600 dark:text-slate-400 font-medium mb-1">Día</Text>
              <TouchableOpacity
                className="w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-3 flex-row items-center justify-between"
                onPress={() => { if (Platform.OS !== 'web') setShowDatePicker(true); }}
                activeOpacity={Platform.OS === 'web' ? 1 : 0.7}
              >
                {Platform.OS !== 'web' ? (
                  <>
                    <Text className={dateText ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                      {dateText || 'DD/MM/YYYY'}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#22C55E" />
                  </>
                ) : (
                  <TextInput
                    className="flex-1 text-slate-900 dark:text-white"
                    placeholder="05/04/2026"
                    placeholderTextColor="#9ca3af"
                    value={dateText}
                    onChangeText={handleDateChangeText}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                )}
              </TouchableOpacity>
            </View>
            <View className="flex-1 ml-2">
              <Text className="text-slate-600 dark:text-slate-400 font-medium mb-1">Hora</Text>
              <TouchableOpacity
                className="w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-3 flex-row items-center justify-between"
                onPress={() => { if (Platform.OS !== 'web') setShowTimePicker(true); }}
                activeOpacity={Platform.OS === 'web' ? 1 : 0.7}
              >
                {Platform.OS !== 'web' ? (
                  <>
                    <Text className={timeText ? 'text-slate-900 dark:text-white' : 'text-slate-400'}>
                      {timeText || 'HH:MM'}
                    </Text>
                    <Ionicons name="time-outline" size={20} color="#22C55E" />
                  </>
                ) : (
                  <TextInput
                    className="flex-1 text-slate-900 dark:text-white"
                    placeholder="20:00"
                    placeholderTextColor="#9ca3af"
                    value={timeText}
                    onChangeText={handleTimeChangeText}
                    onBlur={handleTimeBlur}
                    keyboardType="numeric"
                    maxLength={5}
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Native Date/Time Pickers */}
        {Platform.OS === 'android' && showDatePicker && (
          <DateTimePicker
            value={dateObj}
            mode="date"
            display="default"
            onChange={onDatePickerChange}
            minimumDate={new Date()}
            locale="es-ES"
          />
        )}
        {Platform.OS === 'ios' && showDatePicker && (
          <Modal transparent animationType="slide" visible={showDatePicker}>
            <View className="flex-1 justify-end bg-black/60">
              <View className="bg-white dark:bg-gray-900 pb-10 pt-4 px-6 rounded-t-3xl shadow-xl">
                <View className="flex-row justify-between mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text className="text-red-500 font-medium text-lg">Cancelar</Text>
                  </TouchableOpacity>
                  <Text className="text-slate-800 dark:text-slate-100 font-bold text-lg">Fecha del partido</Text>
                  <TouchableOpacity onPress={confirmDateIOS}>
                    <Text className="text-green-500 font-bold text-lg">Confirmar</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={dateObj}
                  mode="date"
                  display="spinner"
                  onChange={onDatePickerChange}
                  minimumDate={new Date()}
                  locale="es-ES"
                />
              </View>
            </View>
          </Modal>
        )}

        {Platform.OS === 'android' && showTimePicker && (
          <DateTimePicker
            value={dateObj}
            mode="time"
            display="default"
            onChange={onTimePickerChange}
            is24Hour={true}
            locale="es-ES"
          />
        )}
        {Platform.OS === 'ios' && showTimePicker && (
          <Modal transparent animationType="slide" visible={showTimePicker}>
            <View className="flex-1 justify-end bg-black/60">
              <View className="bg-white dark:bg-gray-900 pb-10 pt-4 px-6 rounded-t-3xl shadow-xl">
                <View className="flex-row justify-between mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                  <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                    <Text className="text-red-500 font-medium text-lg">Cancelar</Text>
                  </TouchableOpacity>
                  <Text className="text-slate-800 dark:text-slate-100 font-bold text-lg">Hora del partido</Text>
                  <TouchableOpacity onPress={confirmTimeIOS}>
                    <Text className="text-green-500 font-bold text-lg">Confirmar</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={dateObj}
                  mode="time"
                  display="spinner"
                  onChange={onTimePickerChange}
                  is24Hour={true}
                  locale="es-ES"
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Jugadores Necesarios */}
        <View className="bg-slate-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
          <Text className="text-slate-700 dark:text-slate-300 font-bold mb-3 text-lg">Jugadores necesarios</Text>
          {[
            { key: 'portero', label: 'Porteros', icon: 'hand-left-outline' },
            { key: 'defensa', label: 'Defensas', icon: 'shield-outline' },
            { key: 'mediocentro', label: 'Medios', icon: 'apps-outline' },
            { key: 'delantero', label: 'Delanteros', icon: 'flash-outline' },
            { key: 'cualquiera', label: 'Cualquier Posición', icon: 'people-outline' },
          ].map((pos) => (
            <View key={pos.key} className="flex-row justify-between items-center mb-3 p-2 bg-white dark:bg-gray-900 rounded-lg border border-slate-100 dark:border-slate-800">
              <View className="flex-row items-center">
                <Ionicons name={pos.icon as any} size={20} color="#64748b" />
                <Text className="ml-3 text-slate-700 dark:text-slate-300 font-medium">{pos.label}</Text>
              </View>
              <View className="flex-row items-center">
                <TouchableOpacity onPress={() => updatePosition(pos.key as PositionKey, -1)} className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 items-center justify-center">
                  <Ionicons name="remove" size={18} color="#64748b" />
                </TouchableOpacity>
                <Text className="mx-4 font-bold text-xl dark:text-white w-6 text-center">{positions[pos.key as PositionKey]}</Text>
                <TouchableOpacity onPress={() => updatePosition(pos.key as PositionKey, 1)} className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900 items-center justify-center">
                  <Ionicons name="add" size={18} color="#22C55E" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View className="mt-2 pt-3 border-t border-slate-200 dark:border-gray-800 flex-row justify-between items-center">
            <Text className="text-slate-500 font-medium">Total jugadores:</Text>
            <View className="bg-green-500 px-4 py-1 rounded-full">
              <Text className="font-bold text-white text-lg">{totalPlayers}</Text>
            </View>
          </View>
        </View>

        {/* Colores de Equipos */}
        <View className="bg-slate-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800">
          <Text className="text-slate-700 dark:text-slate-300 font-bold mb-4 text-lg">Colores de Camiseta</Text>
          <View className="flex-row justify-between">
            <View className="flex-1 mr-3">
              <View className="flex-row items-center mb-3">
                <View className="w-8 h-8 rounded-full border-2 border-green-500 mr-2" style={{ backgroundColor: teamAColor }} />
                <Text className="text-slate-600 dark:text-slate-400 font-semibold">Equipo A</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {presetColors.map(c => (
                  <TouchableOpacity
                    key={`a-${c}`}
                    onPress={() => setTeamAColor(c)}
                    className={`w-9 h-9 rounded-full border-2 ${teamAColor === c ? 'border-green-500' : 'border-slate-200 dark:border-slate-600'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </View>
            </View>
            <View className="w-px bg-slate-200 dark:bg-slate-600 mx-2" />
            <View className="flex-1 ml-3">
              <View className="flex-row items-center mb-3">
                <View className="w-8 h-8 rounded-full border-2 border-green-500 mr-2" style={{ backgroundColor: teamBColor }} />
                <Text className="text-slate-600 dark:text-slate-400 font-semibold">Equipo B</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {presetColors.map(c => (
                  <TouchableOpacity
                    key={`b-${c}`}
                    onPress={() => setTeamBColor(c)}
                    className={`w-9 h-9 rounded-full border-2 ${teamBColor === c ? 'border-green-500' : 'border-slate-200 dark:border-slate-600'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Configuración Extra */}
        <View className="bg-slate-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 space-y-4">
          <View>
            <Text className="text-slate-600 dark:text-slate-400 font-medium mb-1">Precio por persona (€)</Text>
            <TextInput
              className="w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-3 text-slate-900 dark:text-white"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#9ca3af"
            />
          </View>
          <View className="flex-row justify-between items-center py-2">
            <View className="flex-1 mr-4">
              <Text className="text-slate-700 dark:text-slate-300 font-medium">Aprobar jugadores manualmente</Text>
              <Text className="text-slate-400 text-xs mt-1">El organizador revisa cada solicitud</Text>
            </View>
            <Switch value={requiresApproval} onValueChange={setRequiresApproval} trackColor={{ true: '#22C55E' }} />
          </View>
        </View>

        <View className="flex-row items-center mt-2">
          <TouchableOpacity
            className="flex-1 bg-slate-100 dark:bg-gray-900 rounded-xl p-4 items-center mr-2 border border-slate-200 dark:border-gray-800"
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text className="text-slate-700 dark:text-slate-300 font-bold text-lg">Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-[2] bg-green-500 rounded-xl p-4 items-center shadow-lg ml-2"
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold text-lg uppercase tracking-wider">Publicar</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}
