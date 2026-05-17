import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Switch, ActivityIndicator, Platform, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { TEAM_COLOR_OPTIONS } from '@/constants/teamColors';
import { useTheme } from '@/hooks/use-theme';

const CreateMatchSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
  location: z.string().min(3, 'La ubicación debe tener al menos 3 caracteres'),
  dateText: z.string().min(1, 'Debes indicar la fecha del partido'),
  timeText: z.string().min(1, 'Debes indicar la hora del partido'),
  totalPlayers: z.number().min(1, 'Debes solicitar al menos 1 jugador en las posiciones'),
  price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, 'El precio no es válido'),
});

const LEVELS = [
  { key: 'tranquilo',   label: 'Tranquilo',   emoji: '😌', activeBg: 'bg-brand/20', activeBorder: 'border-brand', color: '#22C55E' },
  { key: 'medio',       label: 'Medio',       emoji: '⚽', activeBg: 'bg-warning/20', activeBorder: 'border-warning', color: '#F59E0B' },
  { key: 'competitivo', label: 'Competitivo', emoji: '🔥', activeBg: 'bg-danger/20', activeBorder: 'border-danger', color: '#EF4444' },
];

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
          <View className="flex-row justify-between mb-3 border-b border-border pb-3">
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

export default function CreateMatchScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

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

  const [positions, setPositions] = useState({
    portero: 0, defensa: 0, mediocentro: 0, delantero: 0, cualquiera: 0,
  });

  const [teamAColor, setTeamAColor] = useState('#EF4444');
  const [teamBColor, setTeamBColor] = useState('#3B82F6');

  const [price, setPrice] = useState('0');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [loading, setLoading] = useState(false);

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
      if (Platform.OS === 'ios') {
        setDraftDateObj(selectedDate);
        return;
      }
      setDateObj(selectedDate);
      if (Platform.OS === 'android') {
        const d = selectedDate;
        setDateText(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
      }
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
      if (Platform.OS === 'android') {
        setTimeText(`${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`);
      }
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
    const timeForParsing = timeText.includes(':') ? timeText : timeText + ':00';
    const [day, month, year] = dateText.split('/');
    const [hours, minutes] = timeForParsing.split(':');
    if (!day || !month || !year || year.length !== 4) return null;
    if (!hours || !minutes) return null;
    const d = parseInt(day), m = parseInt(month), y = parseInt(year);
    const h = parseInt(hours), min = parseInt(minutes);
    if (isNaN(d) || isNaN(m) || isNaN(y) || isNaN(h) || isNaN(min)) return null;
    const dt = new Date(y, m - 1, d, h, min);
    if (isNaN(dt.getTime())) return null;
    if (dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return dt;
  };

  async function handleCreate() {
    const currentTotal = Object.values(positions).reduce((a, b) => a + b, 0);
    try {
      CreateMatchSchema.parse({ title, location, dateText, timeText, totalPlayers: currentTotal, price });
    } catch (err) {
      if (err instanceof z.ZodError) {
        Alert.alert('Error de validación', err.issues[0].message);
        return;
      }
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
          organizer_id: user.id, title, location,
          location_lat: locationLat, location_lng: locationLng, location_city: locationCity,
          venue_id: venueId,
          location_name_snapshot: location,
          address_snapshot: locationAddressSnapshot,
          latitude_snapshot: locationLat,
          longitude_snapshot: locationLng,
          location_quality_status: locationQualityStatus,
          description, level, date_time: finalDateObj.toISOString(),
          requested_positions: positions, team_a_color: teamAColor, team_b_color: teamBColor,
          price_per_player: parseFloat(price) || 0, requires_approval: requiresApproval, status: 'open',
        })
        .select().single();
      if (error) throw error;
      Alert.alert('¡Listo!', 'El partido ya está publicado en Rondo.', [
        { text: 'Ver partido', onPress: () => router.push(`/match/${data.id}`) },
        { text: 'Ir al inicio', onPress: () => router.push('/(tabs)') },
      ]);
      setTitle(''); setLocation(''); setLocationLat(null); setLocationLng(null); setLocationCity(null);
      setVenueId(null); setLocationAddressSnapshot(null); setLocationQualityStatus('confirmed');
      setDescription(''); setLevel('medio'); setDateText(''); setTimeText('');
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
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 32 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <ScreenTitle style={{ marginBottom: 24 }}>
          Crear Partido
        </ScreenTitle>

        {/* 1. Información General */}
        <View className="bg-bg-elev border border-border p-5 rounded-lg-r mb-4">
          <SectionHeader num={1} title="Información" />
          <View className="gap-3.5">
            <View>
              <Text className="text-ink-dim font-body font-semibold text-[11px] uppercase tracking-wider mb-2">Título del Partido</Text>
              <TextInput
                className="bg-input/5 border border-border rounded-md-r px-4 py-3 text-ink font-body text-[15px]"
                placeholder="Fútbol-7 Jueves Tarde"
                placeholderTextColor={colors.textMuted}
                keyboardAppearance="dark"
                value={title}
                onChangeText={setTitle}
              />
            </View>
            <View>
              <Text className="text-ink-dim font-body font-semibold text-[11px] uppercase tracking-wider mb-2">Ubicación</Text>
              {/* Note: Assuming UbicacionInput renders its own input or requires styling. Since we can't easily inject classNames into it unless supported, we wrap it if possible or rely on its own styles. If it doesn't take className, it might look slightly off, but let's assume it accepts a style wrapper or similar, actually I will just render it. */}
              <View className="bg-input/5 border border-border rounded-md-r px-4 py-1">
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
                className="bg-input/5 border border-border rounded-md-r px-4 py-3 text-ink font-body text-[15px] min-h-[80px]"
                placeholder="Buen ambiente, nivel medio, cervezas después de jugar"
                placeholderTextColor={colors.textMuted}
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

        {/* 2. Nivel */}
        <View className="bg-bg-elev border border-border p-5 rounded-lg-r mb-4">
          <SectionHeader num={2} title="Nivel" />
          <View className="flex-row gap-2">
            {LEVELS.map(l => {
              const isActive = level === l.key;
              return (
                <TouchableOpacity
                  key={l.key}
                  onPress={() => setLevel(l.key as MatchLevel)}
                  className={`flex-1 py-3.5 rounded-md-r items-center border-2 ${
                    isActive ? `${l.activeBg} ${l.activeBorder}` : 'bg-input/5 border-transparent'
                  }`}
                >
                  <Text className="text-[22px] mb-1">{l.emoji}</Text>
                  <Text style={{ color: isActive ? l.color : colors.textDim }} className="font-body font-bold text-xs">
                    {l.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. Fecha y Hora */}
        <View className="bg-bg-elev border border-border p-5 rounded-lg-r mb-4">
          <SectionHeader num={3} title="Cuándo" />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-ink-dim font-body font-semibold text-[11px] uppercase tracking-wider mb-2">Día</Text>
              <TouchableOpacity
                className="bg-input/5 border border-border rounded-md-r px-4 py-3.5 flex-row items-center justify-between"
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
                    placeholderTextColor={colors.textMuted}
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
                className="bg-input/5 border border-border rounded-md-r px-4 py-3.5 flex-row items-center justify-between"
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
                    placeholderTextColor={colors.textMuted}
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

        {/* Date/Time pickers */}
        {Platform.OS === 'android' && showDatePicker && (
          <DateTimePicker value={dateObj} mode="date" display="default" onChange={onDatePickerChange} minimumDate={new Date()} locale="es-ES" />
        )}
        {Platform.OS === 'ios' && (
          <PickerModal visible={showDatePicker} title="Fecha del partido" onCancel={() => setShowDatePicker(false)} onConfirm={confirmDateIOS}>
            <DateTimePicker value={draftDateObj} mode="date" display="spinner" onChange={onDatePickerChange} minimumDate={new Date()} locale="es-ES" />
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

        {/* 4. Posiciones */}
        <View className="bg-bg-elev border border-border p-5 rounded-lg-r mb-4">
          <SectionHeader num={4} title="Posiciones" />
          <View>
            {[
              { key: 'portero',     label: 'Portero',          emoji: '🧤' },
              { key: 'defensa',     label: 'Defensa',          emoji: '🛡️' },
              { key: 'mediocentro', label: 'Mediocentro',      emoji: '⚙️' },
              { key: 'delantero',   label: 'Delantero',        emoji: '⚡' },
              { key: 'cualquiera',  label: 'Cualquiera',       emoji: '⚽' },
            ].map((pos) => (
              <View key={pos.key} className="flex-row justify-between items-center py-3 border-b border-border last:border-b-0">
                <View className="flex-row items-center gap-3">
                  <Text className="text-xl">{pos.emoji}</Text>
                  <Text className="text-ink font-body font-semibold text-sm">{pos.label}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <TouchableOpacity
                    onPress={() => updatePosition(pos.key as PositionKey, -1)}
                    className="w-9 h-9 rounded-md-r bg-input/5 items-center justify-center border border-border"
                  >
                    <Ionicons name="remove" size={18} color={colors.textDim} />
                  </TouchableOpacity>
                  <Text className="w-8 text-center font-body font-bold text-lg text-ink">
                    {positions[pos.key as PositionKey]}
                  </Text>
                  <TouchableOpacity
                    onPress={() => updatePosition(pos.key as PositionKey, 1)}
                    className="w-9 h-9 rounded-md-r bg-brand-soft items-center justify-center border border-brand/30"
                  >
                    <Ionicons name="add" size={18} color="#22C55E" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
          <View className="flex-row justify-between items-center mt-4 pt-4 border-t border-border">
            <Text className="text-ink-dim font-body font-semibold text-sm">Total jugadores</Text>
            <View className="bg-brand px-4 py-1.5 rounded-full">
              <Text className="font-body font-black text-white text-base">{totalPlayers}</Text>
            </View>
          </View>
        </View>

        {/* 5. Colores de Equipos */}
        <View className="bg-bg-elev border border-border p-5 rounded-lg-r mb-4">
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

        {/* 6. Extra */}
        <View className="bg-bg-elev border border-border p-5 rounded-lg-r mb-6">
          <SectionHeader num={6} title="Configuración" />
          <View className="mb-5">
            <Text className="text-ink-dim font-body font-semibold text-[11px] uppercase tracking-wider mb-2">Precio por persona (€)</Text>
            <TextInput
              className="bg-input/5 border border-border rounded-md-r px-4 py-3.5 text-ink font-body text-[15px]"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
              keyboardAppearance="dark"
              placeholder="0.00"
              placeholderTextColor={colors.textMuted}
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

        {/* Actions */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            disabled={loading}
            className="flex-1 bg-input/5 border border-border rounded-xl-r py-4 items-center justify-center"
          >
            <Text className="text-ink-dim font-display font-bold text-[15px]">Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCreate}
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
                Publicar Partido
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
