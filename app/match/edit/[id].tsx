import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Switch, ActivityIndicator, Platform, Modal } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useLocalSearchParams, Stack, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { UbicacionInput } from '@/components/UbicacionInput';
import type { GeoResult } from '@/lib/geocoding';

const LEVELS = [
  { key: 'tranquilo', label: 'Tranquilo', emoji: '😌', color: 'bg-green-100 border-green-400', activeColor: 'bg-green-500 border-green-500', text: 'text-green-700', activeText: 'text-white' },
  { key: 'medio', label: 'Medio', emoji: '⚽', color: 'bg-amber-100 border-amber-400', activeColor: 'bg-amber-500 border-amber-500', text: 'text-amber-700', activeText: 'text-white' },
  { key: 'competitivo', label: 'Competitivo', emoji: '🔥', color: 'bg-red-100 border-red-400', activeColor: 'bg-red-500 border-red-500', text: 'text-red-700', activeText: 'text-white' },
];

export default function EditMatchScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const navigation = useNavigation();

  const [loadingData, setLoadingData] = useState(true);
  const [loading, setLoading] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationCity, setLocationCity] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<'tranquilo' | 'medio' | 'competitivo'>('medio');

  // Fecha y Hora
  const [dateObj, setDateObj] = useState(new Date());
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Posiciones
  const [positions, setPositions] = useState<Record<string, number>>({
    portero: 0, defensa: 0, mediocentro: 0, delantero: 0, cualquiera: 0,
  });

  // Colores de equipo
  const [teamAColor, setTeamAColor] = useState('#EF4444');
  const [teamBColor, setTeamBColor] = useState('#3B82F6');
  const presetColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#111827', '#FFFFFF'];

  const [price, setPrice] = useState('0');
  const [requiresApproval, setRequiresApproval] = useState(false);

  // Track initial state to detect unsaved changes
  const [initialStateStr, setInitialStateStr] = useState<string>('');

  useEffect(() => {
    async function loadMatch() {
      if (!id) return;
      const { data, error } = await supabase.from('matches').select('*').eq('id', id).single();
      if (error || !data) {
        Alert.alert('Error', 'No se pudo cargar el partido');
        router.back();
        return;
      }
      
      if (data.organizer_id !== user?.id) {
        Alert.alert('No autorizado', 'No puedes editar un partido que no organizaste');
        router.back();
        return;
      }

      setTitle(data.title);
      setLocation(data.location);
      setLocationLat((data as any).location_lat ?? null);
      setLocationLng((data as any).location_lng ?? null);
      setLocationCity((data as any).location_city ?? null);
      setDescription(data.description || '');
      setLevel(data.level as any || 'medio');
      setTeamAColor(data.team_a_color || '#EF4444');
      setTeamBColor(data.team_b_color || '#3B82F6');
      setPrice(String(data.price_per_player || 0));
      setRequiresApproval(data.requires_approval || false);
      
      if (data.requested_positions) {
         setPositions(data.requested_positions as Record<string, number>);
      }

      // Restore Dates
      const dt = new Date(data.date_time);
      setDateObj(dt);
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      const loadedDateText = `${dd}/${mm}/${yyyy}`;
      setDateText(loadedDateText);
      
      const hh = String(dt.getHours()).padStart(2, '0');
      const min = String(dt.getMinutes()).padStart(2, '0');
      const loadedTimeText = `${hh}:${min}`;
      setTimeText(loadedTimeText);

      // Save initial state fingerprint
      setInitialStateStr(JSON.stringify({
        title: data.title,
        location: data.location,
        description: data.description || '',
        level: data.level || 'medio',
        teamAColor: data.team_a_color || '#EF4444',
        teamBColor: data.team_b_color || '#3B82F6',
        price: String(data.price_per_player || 0),
        requiresApproval: data.requires_approval || false,
        positions: data.requested_positions || { portero: 0, defensa: 0, mediocentro: 0, delantero: 0, cualquiera: 0 },
        dateText: loadedDateText,
        timeText: loadedTimeText
      }));

      setLoadingData(false);
    }
    loadMatch();
  }, [id, user]);

  // Navigation guard removed from here because we moved it to headerLeft in Stack.Screen


  const handleDateChangeText = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    if (cleaned.length > 4) formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4) + '/' + cleaned.slice(4, 8);
    setDateText(formatted);
  };

  const handleTimeChangeText = (text: string) => {
    let cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = cleaned.slice(0, 2) + ':' + cleaned.slice(2, 4);
    setTimeText(formatted);
  };

  const handleTimeBlur = () => {
    let t = timeText.replace(/[^0-9]/g, '');
    if (t.length === 0) return;
    if (t.length <= 2) setTimeText(t.padStart(2, '0') + ':00');
    else if (t.length === 3) setTimeText(t.slice(0, 1) + ':' + t.slice(1));
    else setTimeText(t.slice(0, 2) + ':' + t.slice(2, 4));
  };

  const onDatePickerChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      if (Platform.OS === 'android') {
        setDateText(`${String(selectedDate.getDate()).padStart(2,'0')}/${String(selectedDate.getMonth()+1).padStart(2,'0')}/${selectedDate.getFullYear()}`);
      }
    }
  };

  const onTimePickerChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      if (Platform.OS === 'android') {
        setTimeText(`${String(selectedDate.getHours()).padStart(2,'0')}:${String(selectedDate.getMinutes()).padStart(2,'0')}`);
      }
    }
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

  async function handleUpdate() {
    if (!title || !location) {
      Alert.alert('Error', 'Debes completar el título y la ubicación.');
      return;
    }
    const finalDateObj = validateAndParseDateTime();
    if (!finalDateObj) {
      Alert.alert('Error', 'La fecha u hora tienen un formato incorrecto. Usa DD/MM/YYYY y HH:MM.');
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('matches')
        .update({
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
        })
        .eq('id', id);

      if (error) throw error;
      
      // Update string to prevent unsaved changes dialog since we just saved successfully
      setInitialStateStr(JSON.stringify({
        title, location, description, level, teamAColor, teamBColor, price, requiresApproval, positions, dateText, timeText
      }));

      Alert.alert('¡Actualizado!', 'Los cambios del partido se guardaron correctamente.', [
        { text: 'Volver', onPress: () => router.back() }
      ]);
    } catch (e: any) {
      Alert.alert('Error al actualizar', e.message);
    } finally {
      setLoading(false);
    }
  }

  const updatePosition = (pos: string, increment: number) => {
    setPositions(prev => {
      const newVal = (prev[pos] || 0) + increment;
      return { ...prev, [pos]: newVal < 0 ? 0 : newVal };
    });
  };

  const totalPlayers = Object.values(positions).reduce((a, b) => a + b, 0);

  if (loadingData) {
    return <View className="flex-1 justify-center items-center bg-neutral-950"><ActivityIndicator size="large" color="#22C55E" /></View>;
  }

  return (
    <ScrollView className="flex-1 bg-neutral-950" keyboardShouldPersistTaps="handled">
      <Stack.Screen 
        options={{ 
          title: 'Editar Partido',
          gestureEnabled: false,
          headerLeft: () => (
            <TouchableOpacity 
              onPress={() => {
                const currentStateStr = JSON.stringify({
                  title, location, description, level, teamAColor, teamBColor, price, requiresApproval, positions, dateText, timeText
                });
                if (currentStateStr !== initialStateStr && !loading && !loadingData) {
                  Alert.alert('Descartar cambios', 'Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Salir sin guardar', style: 'destructive', onPress: () => router.back() }
                  ]);
                } else {
                  router.back();
                }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -8, padding: 8 }}
            >
              <Ionicons name="chevron-back" size={28} color="#22C55E" />
            </TouchableOpacity>
          )
        }} 
      />
      <View className="p-4 space-y-5 mb-10">

        <View className="bg-gray-900 p-4 rounded-xl border border-gray-800">
          <Text className="text-slate-300 font-bold mb-3 text-lg">Información General</Text>
          <View className="mb-4">
            <Text className="text-slate-400 font-medium mb-1">Título del Partido</Text>
            <TextInput
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
              value={title} onChangeText={setTitle}
            />
          </View>
          <View className="mb-4">
            <Text className="text-slate-400 font-medium mb-1">Ubicación</Text>
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
            <Text className="text-slate-400 font-medium mb-1">Descripción</Text>
            <TextInput
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white"
              value={description} onChangeText={setDescription}
              multiline numberOfLines={3} textAlignVertical="top"
            />
          </View>
        </View>

        <View className="bg-gray-900 p-4 rounded-xl border border-gray-800">
          <Text className="text-slate-300 font-bold mb-3 text-lg">Nivel del Partido</Text>
          <View className="flex-row gap-2">
            {LEVELS.map(l => {
              const isActive = level === l.key;
              return (
                <TouchableOpacity
                  key={l.key} onPress={() => setLevel(l.key as any)}
                  className={`flex-1 py-3 rounded-xl border-2 items-center ${isActive ? l.activeColor : l.color}`}
                >
                  <Text className="text-xl mb-1">{l.emoji}</Text>
                  <Text className={`font-bold text-sm ${isActive ? l.activeText : l.text}`}>{l.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <Text className="text-slate-300 font-bold mb-3 text-lg">Cuándo jugamos</Text>
          <View className="flex-row space-x-3">
            <View className="flex-1 mr-2">
              <Text className="text-slate-400 font-medium mb-1">Día</Text>
              <TouchableOpacity
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 flex-row items-center justify-between"
                onPress={() => { if (Platform.OS !== 'web') setShowDatePicker(true); }}
              >
                {Platform.OS !== 'web' ? (
                  <><Text className="text-white">{dateText || 'DD/MM/YYYY'}</Text><Ionicons name="calendar-outline" size={20} color="#22C55E" /></>
                ) : (
                  <TextInput className="flex-1 text-white" value={dateText} onChangeText={handleDateChangeText} keyboardType="numeric" maxLength={10} />
                )}
              </TouchableOpacity>
            </View>
            <View className="flex-1 ml-2">
              <Text className="text-slate-400 font-medium mb-1">Hora</Text>
              <TouchableOpacity
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 flex-row items-center justify-between"
                onPress={() => { if (Platform.OS !== 'web') setShowTimePicker(true); }}
              >
                {Platform.OS !== 'web' ? (
                  <><Text className="text-white">{timeText || 'HH:MM'}</Text><Ionicons name="time-outline" size={20} color="#22C55E" /></>
                ) : (
                  <TextInput className="flex-1 text-white" value={timeText} onChangeText={handleTimeChangeText} onBlur={handleTimeBlur} keyboardType="numeric" maxLength={5} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {Platform.OS === 'android' && showDatePicker && <DateTimePicker value={dateObj} mode="date" display="default" onChange={onDatePickerChange} locale="es-ES" />}
        {Platform.OS === 'android' && showTimePicker && <DateTimePicker value={dateObj} mode="time" display="default" onChange={onTimePickerChange} is24Hour={true} />}

        {Platform.OS === 'ios' && showDatePicker && (
          <Modal transparent animationType="slide" visible={showDatePicker}>
            <View className="flex-1 justify-end bg-black/60">
              <View className="bg-white dark:bg-gray-900 pb-10 pt-4 px-6 rounded-t-3xl shadow-xl">
                <View className="flex-row justify-between mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text className="text-red-500 font-medium text-lg">Cancelar</Text>
                  </TouchableOpacity>
                  <Text className="text-slate-800 dark:text-slate-100 font-bold text-lg">Fecha</Text>
                  <TouchableOpacity onPress={() => { setShowDatePicker(false); setDateText(`${String(dateObj.getDate()).padStart(2,'0')}/${String(dateObj.getMonth()+1).padStart(2,'0')}/${dateObj.getFullYear()}`); }}>
                    <Text className="text-green-500 font-bold text-lg">Confirmar</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker value={dateObj} mode="date" display="spinner" onChange={onDatePickerChange} locale="es-ES" />
              </View>
            </View>
          </Modal>
        )}

        {Platform.OS === 'ios' && showTimePicker && (
          <Modal transparent animationType="slide" visible={showTimePicker}>
            <View className="flex-1 justify-end bg-black/60">
              <View className="bg-white dark:bg-gray-900 pb-10 pt-4 px-6 rounded-t-3xl shadow-xl">
                <View className="flex-row justify-between mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                  <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                    <Text className="text-red-500 font-medium text-lg">Cancelar</Text>
                  </TouchableOpacity>
                  <Text className="text-slate-800 dark:text-slate-100 font-bold text-lg">Hora</Text>
                  <TouchableOpacity onPress={() => { setShowTimePicker(false); setTimeText(`${String(dateObj.getHours()).padStart(2,'0')}:${String(dateObj.getMinutes()).padStart(2,'0')}`); }}>
                    <Text className="text-green-500 font-bold text-lg">Confirmar</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker value={dateObj} mode="time" display="spinner" onChange={onTimePickerChange} is24Hour={true} />
              </View>
            </View>
          </Modal>
        )}

        <View className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <Text className="text-slate-300 font-bold mb-3 text-lg">Jugadores necesarios</Text>
          {[
            { key: 'portero', label: 'Porteros', icon: 'hand-left-outline' },
            { key: 'defensa', label: 'Defensas', icon: 'shield-outline' },
            { key: 'mediocentro', label: 'Medios', icon: 'apps-outline' },
            { key: 'delantero', label: 'Delanteros', icon: 'flash-outline' },
            { key: 'cualquiera', label: 'Cualquier Posición', icon: 'people-outline' },
          ].map(pos => (
            <View key={pos.key} className="flex-row justify-between items-center mb-3 p-2 bg-slate-900 rounded-lg border border-slate-800">
              <View className="flex-row items-center">
                <Ionicons name={pos.icon as any} size={20} color="#64748b" />
                <Text className="ml-3 text-slate-300 font-medium">{pos.label}</Text>
              </View>
              <View className="flex-row items-center">
                <TouchableOpacity onPress={() => updatePosition(pos.key, -1)} className="w-9 h-9 rounded-full bg-slate-700 items-center justify-center">
                  <Ionicons name="remove" size={18} color="#94a3b8" />
                </TouchableOpacity>
                <Text className="mx-4 font-bold text-xl text-white w-6 text-center">{positions[pos.key] || 0}</Text>
                <TouchableOpacity onPress={() => updatePosition(pos.key, 1)} className="w-9 h-9 rounded-full bg-green-500/20 items-center justify-center">
                  <Ionicons name="add" size={18} color="#22C55E" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View className="mt-2 pt-3 border-t border-slate-700 flex-row justify-between items-center">
            <Text className="text-slate-400 font-medium">Total jugadores:</Text>
            <View className="bg-green-500 px-4 py-1 rounded-full"><Text className="font-bold text-white text-lg">{totalPlayers}</Text></View>
          </View>
        </View>

        <View className="bg-slate-800 p-4 rounded-xl border border-slate-700">
          <Text className="text-slate-300 font-bold mb-4 text-lg">Colores de Camiseta</Text>
          <View className="flex-row justify-between">
            <View className="flex-1 mr-3">
              <View className="flex-row items-center mb-3">
                <View className="w-8 h-8 rounded-full border-2 border-green-500 mr-2" style={{ backgroundColor: teamAColor }} />
                <Text className="text-slate-400 font-semibold">Equipo A</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {presetColors.map(c => <TouchableOpacity key={`a-${c}`} onPress={() => setTeamAColor(c)} className={`w-9 h-9 rounded-full border-2 ${teamAColor === c ? 'border-green-500' : 'border-slate-600'}`} style={{ backgroundColor: c }} />)}
              </View>
            </View>
            <View className="w-px bg-slate-600 mx-2" />
            <View className="flex-1 ml-3">
              <View className="flex-row items-center mb-3">
                <View className="w-8 h-8 rounded-full border-2 border-green-500 mr-2" style={{ backgroundColor: teamBColor }} />
                <Text className="text-slate-400 font-semibold">Equipo B</Text>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {presetColors.map(c => <TouchableOpacity key={`b-${c}`} onPress={() => setTeamBColor(c)} className={`w-9 h-9 rounded-full border-2 ${teamBColor === c ? 'border-green-500' : 'border-slate-600'}`} style={{ backgroundColor: c }} />)}
              </View>
            </View>
          </View>
        </View>

        <View className="bg-slate-800 p-4 rounded-xl border border-slate-700 space-y-4">
          <View>
            <Text className="text-slate-400 font-medium mb-1">Precio por persona (€)</Text>
            <TextInput className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white" value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="0.00" placeholderTextColor="#64748b" />
          </View>
          <View className="flex-row justify-between items-center py-2">
            <View className="flex-1 mr-4">
              <Text className="text-slate-300 font-medium">Aprobar jugadores</Text>
            </View>
            <Switch value={requiresApproval} onValueChange={setRequiresApproval} trackColor={{ true: '#22C55E' }} />
          </View>
        </View>

        <TouchableOpacity className="w-full bg-green-500 rounded-xl p-4 items-center shadow-lg" style={{ minHeight: 48 }} onPress={handleUpdate} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text className="text-white font-bold text-xl uppercase tracking-wider">Guardar Cambios</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
