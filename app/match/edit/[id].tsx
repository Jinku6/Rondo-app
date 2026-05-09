import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { UbicacionInput } from '@/components/UbicacionInput';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { TEAM_COLOR_OPTIONS } from '@/constants/teamColors';
import type { GeoResult } from '@/lib/geocoding';
import { supabase } from '@/lib/supabase';
import { getErrorMessage, logSupabaseError } from '@/lib/supabaseErrors';
import { isValidHexColor } from '@/lib/utils';
import type { MatchLevel, PositionKey } from '@/types/database';

const LEVELS = [
  { key: 'tranquilo', label: 'Tranquilo', emoji: '😌', activeBg: 'bg-brand/20', activeBorder: 'border-brand', color: '#22C55E' },
  { key: 'medio', label: 'Medio', emoji: '⚽', activeBg: 'bg-warning/20', activeBorder: 'border-warning', color: '#F59E0B' },
  { key: 'competitivo', label: 'Competitivo', emoji: '🔥', activeBg: 'bg-danger/20', activeBorder: 'border-danger', color: '#EF4444' },
] as const;

const POSITION_OPTIONS: readonly { key: PositionKey; label: string; emoji: string }[] = [
  { key: 'portero', label: 'Portero', emoji: '🧤' },
  { key: 'defensa', label: 'Defensa', emoji: '🛡️' },
  { key: 'mediocentro', label: 'Mediocentro', emoji: '⚙️' },
  { key: 'delantero', label: 'Delantero', emoji: '⚡' },
  { key: 'cualquiera', label: 'Cualquiera', emoji: '⚽' },
];

const DEFAULT_POSITIONS: Record<PositionKey, number> = {
  portero: 0,
  defensa: 0,
  mediocentro: 0,
  delantero: 0,
  cualquiera: 0,
};

const SectionHeader = ({ num, title }: { num: number; title: string }) => (
  <View className="flex-row items-center mb-5">
    <View className="w-6 h-6 rounded-full bg-brand items-center justify-center mr-3">
      <Text className="text-white font-mono font-bold text-xs">{num}</Text>
    </View>
    <Text className="text-ink font-mono tracking-widest text-[11px] uppercase font-bold">
      {title}
    </Text>
  </View>
);

function PickerModal({
  visible,
  title,
  onCancel,
  onConfirm,
  children,
}: {
  visible: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal transparent animationType="slide" visible={visible}>
      <View className="flex-1 justify-end bg-black/70">
        <View className="bg-bg-elev pb-10 pt-4 px-6 rounded-t-3xl">
          <View className="flex-row justify-between mb-3 border-b border-white/10 pb-3">
            <TouchableOpacity onPress={onCancel}>
              <Text className="text-danger font-semibold text-base">Cancelar</Text>
            </TouchableOpacity>
            <Text className="text-ink font-bold text-base">{title}</Text>
            <TouchableOpacity onPress={onConfirm}>
              <Text className="text-brand font-bold text-base">Confirmar</Text>
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

export default function EditMatchScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [loadingData, setLoadingData] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialStateStr, setInitialStateStr] = useState('');

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationCity, setLocationCity] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [locationAddressSnapshot, setLocationAddressSnapshot] = useState<string | null>(null);
  const [locationQualityStatus, setLocationQualityStatus] = useState<'confirmed' | 'user_adjusted' | 'external_unverified'>('confirmed');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<MatchLevel>('medio');

  const [dateObj, setDateObj] = useState(new Date());
  const [draftDateObj, setDraftDateObj] = useState(new Date());
  const [draftTimeObj, setDraftTimeObj] = useState(new Date());
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [positions, setPositions] = useState<Record<PositionKey, number>>(DEFAULT_POSITIONS);
  const [teamAColor, setTeamAColor] = useState('#EF4444');
  const [teamBColor, setTeamBColor] = useState('#3B82F6');
  const [price, setPrice] = useState('0');
  const [requiresApproval, setRequiresApproval] = useState(false);

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

      const loadedPositions = (data.requested_positions as Record<PositionKey, number> | null) || DEFAULT_POSITIONS;
      const loadedLevel = (data.level as MatchLevel) || 'medio';
      const loadedTeamAColor = data.team_a_color || '#EF4444';
      const loadedTeamBColor = data.team_b_color || '#3B82F6';
      const loadedPrice = String(data.price_per_player || 0);
      const loadedRequiresApproval = data.requires_approval || false;
      const dt = new Date(data.date_time);
      const loadedDateText = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
      const loadedTimeText = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;

      setTitle(data.title);
      setLocation(data.location);
      setLocationLat((data as any).location_lat ?? null);
      setLocationLng((data as any).location_lng ?? null);
      setLocationCity((data as any).location_city ?? null);
      setVenueId((data as any).venue_id ?? null);
      setLocationAddressSnapshot((data as any).address_snapshot ?? null);
      setLocationQualityStatus((data as any).location_quality_status ?? 'confirmed');
      setDescription(data.description || '');
      setLevel(loadedLevel);
      setTeamAColor(loadedTeamAColor);
      setTeamBColor(loadedTeamBColor);
      setPrice(loadedPrice);
      setRequiresApproval(loadedRequiresApproval);
      setPositions(loadedPositions);
      setDateObj(dt);
      setDraftDateObj(dt);
      setDraftTimeObj(dt);
      setDateText(loadedDateText);
      setTimeText(loadedTimeText);

      setInitialStateStr(JSON.stringify({
        title: data.title,
        location: data.location,
        venueId: (data as any).venue_id ?? null,
        description: data.description || '',
        level: loadedLevel,
        teamAColor: loadedTeamAColor,
        teamBColor: loadedTeamBColor,
        price: loadedPrice,
        requiresApproval: loadedRequiresApproval,
        positions: loadedPositions,
        dateText: loadedDateText,
        timeText: loadedTimeText,
      }));

      setLoadingData(false);
    }

    loadMatch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  const handleDateChangeText = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    if (cleaned.length > 4) formatted = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    setDateText(formatted);
  };

  const handleTimeChangeText = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = `${cleaned.slice(0, 2)}:${cleaned.slice(2, 4)}`;
    setTimeText(formatted);
  };

  const handleTimeBlur = () => {
    const t = timeText.replace(/[^0-9]/g, '');
    if (t.length === 0) return;
    if (t.length <= 2) setTimeText(`${t.padStart(2, '0')}:00`);
    else if (t.length === 3) setTimeText(`${t.slice(0, 1)}:${t.slice(1)}`);
    else setTimeText(`${t.slice(0, 2)}:${t.slice(2, 4)}`);
  };

  const onDatePickerChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      if (Platform.OS === 'ios') {
        setDraftDateObj(selectedDate);
        return;
      }
      setDateObj(selectedDate);
      setDateText(`${String(selectedDate.getDate()).padStart(2, '0')}/${String(selectedDate.getMonth() + 1).padStart(2, '0')}/${selectedDate.getFullYear()}`);
    }
  };

  const openDatePicker = () => {
    setDraftDateObj(dateObj);
    setShowDatePicker(true);
  };

  const confirmDateIOS = () => {
    setShowDatePicker(false);
    const d = draftDateObj;
    setDateObj(d);
    setDateText(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
  };

  const onTimePickerChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selectedDate) {
      if (Platform.OS === 'ios') {
        setDraftTimeObj(selectedDate);
        return;
      }
      setDateObj(selectedDate);
      setTimeText(`${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`);
    }
  };

  const openTimePicker = () => {
    setDraftTimeObj(dateObj);
    setShowTimePicker(true);
  };

  const confirmTimeIOS = () => {
    setShowTimePicker(false);
    setDateObj(draftTimeObj);
    setTimeText(`${String(draftTimeObj.getHours()).padStart(2, '0')}:${String(draftTimeObj.getMinutes()).padStart(2, '0')}`);
  };

  const validateAndParseDateTime = () => {
    if (!dateText || !timeText) return null;
    const timeForParsing = timeText.includes(':') ? timeText : `${timeText}:00`;
    const [day, month, year] = dateText.split('/');
    const [hours, minutes] = timeForParsing.split(':');
    if (!day || !month || !year || year.length !== 4) return null;
    if (!hours || !minutes) return null;

    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    const h = parseInt(hours, 10);
    const min = parseInt(minutes, 10);
    if (isNaN(d) || isNaN(m) || isNaN(y) || isNaN(h) || isNaN(min)) return null;

    const dt = new Date(y, m - 1, d, h, min);
    if (isNaN(dt.getTime())) return null;
    if (dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return dt;
  };

  async function handleUpdate() {
    if (!title || !location) {
      Alert.alert('Error', 'Debes completar el título y la ubicación.');
      return;
    }

    if (!locationLat || !locationLng || !locationCity) {
      Alert.alert('UbicaciÃ³n sin geolocalizar', 'Selecciona la ubicaciÃ³n desde el desplegable de sugerencias.');
      return;
    }

    const finalDateObj = validateAndParseDateTime();
    if (finalDateObj && finalDateObj.getTime() < Date.now()) {
      Alert.alert('Error', 'No puedes establecer una fecha y hora en el pasado.');
      return;
    }
    if (!finalDateObj) {
      Alert.alert('Error', 'La fecha u hora tienen un formato incorrecto. Usa DD/MM/YYYY y HH:MM.');
      return;
    }

    if (!isValidHexColor(teamAColor) || !isValidHexColor(teamBColor)) {
      Alert.alert('Color inválido', 'Los colores de equipo deben ser valores hexadecimales válidos.');
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
          venue_id: venueId,
          location_name_snapshot: location,
          address_snapshot: locationAddressSnapshot,
          latitude_snapshot: locationLat,
          longitude_snapshot: locationLng,
          location_quality_status: locationQualityStatus,
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

      setInitialStateStr(JSON.stringify({
        title, location, venueId, description, level, teamAColor, teamBColor, price, requiresApproval, positions, dateText, timeText,
      }));

      Alert.alert('Actualizado', 'Los cambios del partido se guardaron correctamente.', [
        { text: 'Volver', onPress: () => router.replace('/(tabs)/mymatches') },
      ]);
    } catch (e) {
      logSupabaseError('match edit update error', e);
      Alert.alert('Error al actualizar', getErrorMessage(e, 'No se pudo actualizar el partido.'));
    } finally {
      setLoading(false);
    }
  }

  const handleCancel = () => {
    const currentStateStr = JSON.stringify({
      title, location, venueId, description, level, teamAColor, teamBColor, price, requiresApproval, positions, dateText, timeText,
    });

    if (currentStateStr !== initialStateStr && !loading && !loadingData) {
      Alert.alert('Descartar cambios', 'Tienes cambios sin guardar. ¿Seguro que quieres salir?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Salir sin guardar', style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }

    router.back();
  };

  const updatePosition = (pos: PositionKey, increment: number) => {
    setPositions(prev => {
      const newVal = prev[pos] + increment;
      return { ...prev, [pos]: newVal < 0 ? 0 : newVal };
    });
  };

  const totalPlayers = Object.values(positions).reduce((a, b) => a + b, 0);

  if (loadingData) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View className="flex-1 justify-center items-center bg-bg">
          <ActivityIndicator size="large" color="#22C55E" />
        </View>
      </>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle style={{ marginBottom: 24 }}>
          Editar Partido
        </ScreenTitle>

        <View className="bg-bg-elev border border-white/10 p-5 rounded-lg-r mb-4">
          <SectionHeader num={1} title="Información" />
          <View className="gap-3.5">
            <View>
              <Text className="text-ink-dim font-body font-semibold text-[11px] uppercase tracking-wider mb-2">Título del Partido</Text>
              <TextInput
                className="bg-white/5 border border-white/10 rounded-md-r px-4 py-3 text-ink font-body text-[15px]"
                placeholder="Fútbol-7 Jueves Tarde"
                placeholderTextColor="#5A625D"
                keyboardAppearance="dark"
                value={title}
                onChangeText={setTitle}
              />
            </View>
            <View>
              <Text className="text-ink-dim font-body font-semibold text-[11px] uppercase tracking-wider mb-2">Ubicación</Text>
              <View className="bg-white/5 border border-white/10 rounded-md-r px-4 py-1">
                <UbicacionInput
                  value={location}
                  createdBy={user?.id}
                  onChangeText={(text) => {
                    setLocation(text);
                    setVenueId(null);
                    setLocationLat(null);
                    setLocationLng(null);
                    setLocationCity(null);
                    setLocationAddressSnapshot(null);
                    setLocationQualityStatus('confirmed');
                  }}
                  onSelect={(r: GeoResult) => {
                    const label = [r.nombre, r.direccion, r.ciudad].filter(Boolean).join(', ');
                    setLocation(label);
                    setLocationLat(r.lat);
                    setLocationLng(r.lng);
                    setLocationCity(r.ciudad);
                    setVenueId(r.venueId || null);
                    setLocationAddressSnapshot(r.direccion || null);
                    setLocationQualityStatus(r.qualityStatus || 'confirmed');
                  }}
                />
              </View>
            </View>
            <View>
              <Text className="text-ink-dim font-body font-semibold text-[11px] uppercase tracking-wider mb-2">Descripción</Text>
              <TextInput
                className="bg-white/5 border border-white/10 rounded-md-r px-4 py-3 text-ink font-body text-[15px] min-h-[80px]"
                placeholder="Buen ambiente, nivel medio, cervezas después de jugar"
                placeholderTextColor="#5A625D"
                keyboardAppearance="dark"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                style={{ textAlignVertical: 'top' }}
              />
            </View>
          </View>
        </View>

        <View className="bg-bg-elev border border-white/10 p-5 rounded-lg-r mb-4">
          <SectionHeader num={2} title="Nivel" />
          <View className="flex-row gap-2">
            {LEVELS.map(l => {
              const isActive = level === l.key;
              return (
                <TouchableOpacity
                  key={l.key}
                  onPress={() => setLevel(l.key)}
                  className={`flex-1 py-3.5 rounded-md-r items-center border-2 ${
                    isActive ? `${l.activeBg} ${l.activeBorder}` : 'bg-white/5 border-transparent'
                  }`}
                >
                  <Text className="text-[22px] mb-1">{l.emoji}</Text>
                  <Text style={{ color: isActive ? l.color : '#8A938F' }} className="font-body font-bold text-xs">
                    {l.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View className="bg-bg-elev border border-white/10 p-5 rounded-lg-r mb-4">
          <SectionHeader num={3} title="Cuándo" />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-ink-dim font-body font-semibold text-[11px] uppercase tracking-wider mb-2">Día</Text>
              <TouchableOpacity
                className="bg-white/5 border border-white/10 rounded-md-r px-4 py-3.5 flex-row items-center justify-between"
                onPress={() => { if (Platform.OS !== 'web') openDatePicker(); }}
                activeOpacity={Platform.OS === 'web' ? 1 : 0.7}
              >
                {Platform.OS !== 'web' ? (
                  <>
                    <Text className={`font-body text-[15px] ${dateText ? 'text-ink' : 'text-ink-muted'}`}>
                      {dateText || 'DD/MM/YYYY'}
                    </Text>
                    <Ionicons name="calendar-outline" size={18} color="#22C55E" />
                  </>
                ) : (
                  <TextInput
                    className="flex-1 text-ink font-body text-[15px]"
                    placeholder="05/04/2026"
                    placeholderTextColor="#5A625D"
                    keyboardAppearance="dark"
                    value={dateText}
                    onChangeText={handleDateChangeText}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                )}
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <Text className="text-ink-dim font-body font-semibold text-[11px] uppercase tracking-wider mb-2">Hora</Text>
              <TouchableOpacity
                className="bg-white/5 border border-white/10 rounded-md-r px-4 py-3.5 flex-row items-center justify-between"
                onPress={() => { if (Platform.OS !== 'web') openTimePicker(); }}
                activeOpacity={Platform.OS === 'web' ? 1 : 0.7}
              >
                {Platform.OS !== 'web' ? (
                  <>
                    <Text className={`font-body text-[15px] ${timeText ? 'text-ink' : 'text-ink-muted'}`}>
                      {timeText || 'HH:MM'}
                    </Text>
                    <Ionicons name="time-outline" size={18} color="#22C55E" />
                  </>
                ) : (
                  <TextInput
                    className="flex-1 text-ink font-body text-[15px]"
                    placeholder="20:00"
                    placeholderTextColor="#5A625D"
                    keyboardAppearance="dark"
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

        {Platform.OS === 'android' && showDatePicker && (
          <DateTimePicker value={dateObj} mode="date" display="default" onChange={onDatePickerChange} locale="es-ES" />
        )}
        {Platform.OS === 'ios' && (
          <PickerModal visible={showDatePicker} title="Fecha del partido" onCancel={() => setShowDatePicker(false)} onConfirm={confirmDateIOS}>
            <DateTimePicker value={draftDateObj} mode="date" display="spinner" onChange={onDatePickerChange} locale="es-ES" />
          </PickerModal>
        )}
        {Platform.OS === 'android' && showTimePicker && (
          <DateTimePicker value={dateObj} mode="time" display="default" onChange={onTimePickerChange} is24Hour locale="es-ES" />
        )}
        {Platform.OS === 'ios' && (
          <PickerModal visible={showTimePicker} title="Hora del partido" onCancel={() => setShowTimePicker(false)} onConfirm={confirmTimeIOS}>
            <DateTimePicker value={draftTimeObj} mode="time" display="spinner" onChange={onTimePickerChange} is24Hour locale="es-ES" />
          </PickerModal>
        )}

        <View className="bg-bg-elev border border-white/10 p-5 rounded-lg-r mb-4">
          <SectionHeader num={4} title="Posiciones" />
          <View>
            {POSITION_OPTIONS.map((pos) => (
              <View key={pos.key} className="flex-row justify-between items-center py-3 border-b border-white/5 last:border-b-0">
                <View className="flex-row items-center gap-3">
                  <Text className="text-xl">{pos.emoji}</Text>
                  <Text className="text-ink font-body font-semibold text-sm">{pos.label}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => updatePosition(pos.key, -1)}
                    className="w-9 h-9 rounded-md-r bg-white/5 items-center justify-center border border-white/10"
                  >
                    <Ionicons name="remove" size={18} color="#8A938F" />
                  </TouchableOpacity>
                  <Text className="w-8 text-center font-body font-bold text-lg text-ink">
                    {positions[pos.key]}
                  </Text>
                  <TouchableOpacity
                    onPress={() => updatePosition(pos.key, 1)}
                    className="w-9 h-9 rounded-md-r bg-brand-soft items-center justify-center border border-brand/30"
                  >
                    <Ionicons name="add" size={18} color="#22C55E" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
          <View className="flex-row justify-between items-center mt-4 pt-4 border-t border-white/10">
            <Text className="text-ink-dim font-body font-semibold text-sm">Total jugadores</Text>
            <View className="bg-brand px-4 py-1.5 rounded-full">
              <Text className="font-body font-black text-white text-base">{totalPlayers}</Text>
            </View>
          </View>
        </View>

        <View className="bg-bg-elev border border-white/10 p-5 rounded-lg-r mb-4">
          <SectionHeader num={5} title="Colores de Camiseta" />
          <View className="flex-row gap-3">
            {[
              { label: 'Equipo A', color: teamAColor, setColor: setTeamAColor, prefix: 'a' },
              { label: 'Equipo B', color: teamBColor, setColor: setTeamBColor, prefix: 'b' },
            ].map(team => (
              <View key={team.prefix} className="flex-1 gap-3">
                <View className="flex-row items-center gap-3">
                  <View className="w-7 h-7 rounded-full border border-white/40" style={{ backgroundColor: team.color }} />
                  <Text className="text-ink font-body font-semibold text-sm">{team.label}</Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {TEAM_COLOR_OPTIONS.map((option) => (
                    <ColorSwatch
                      key={`${team.prefix}-${option.value}`}
                      color={option.value}
                      label={option.label}
                      selected={team.color === option.value}
                      onPress={() => team.setColor(option.value)}
                      size={30}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View className="bg-bg-elev border border-white/10 p-5 rounded-lg-r mb-6">
          <SectionHeader num={6} title="Configuración" />
          <View className="mb-5">
            <Text className="text-ink-dim font-body font-semibold text-[11px] uppercase tracking-wider mb-2">Precio por persona (€)</Text>
            <TextInput
              className="bg-white/5 border border-white/10 rounded-md-r px-4 py-3.5 text-ink font-body text-[15px]"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              keyboardAppearance="dark"
              placeholder="0.00"
              placeholderTextColor="#5A625D"
            />
            <Text className="text-[10px] text-ink-muted mt-2 font-body">
              El organizador gestiona el cobro manualmente.
            </Text>
          </View>

          <View className="flex-row justify-between items-center py-1">
            <View className="flex-1 mr-4">
              <Text className="text-ink font-body font-semibold text-sm">Requiere aprobación</Text>
              <Text className="text-ink-muted text-[11px] mt-1 font-body">Revisa quién se une a tu partido</Text>
            </View>
            <Switch
              value={requiresApproval}
              onValueChange={setRequiresApproval}
              trackColor={{ false: '#3f3f46', true: '#22C55E' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#3f3f46"
            />
          </View>
        </View>

        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={handleCancel}
            disabled={loading}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl-r py-4 items-center justify-center"
          >
            <Text className="text-ink-dim font-display font-bold text-[15px]">Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleUpdate}
            disabled={loading}
            style={{
              shadowColor: '#22C55E',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.32,
              shadowRadius: 14,
              elevation: 8,
            }}
            className={`flex-[2] bg-brand rounded-xl-r py-4 items-center justify-center ${loading ? 'opacity-70' : ''}`}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-display text-[15px] font-black text-white uppercase tracking-[1px]">
                Guardar Cambios
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
