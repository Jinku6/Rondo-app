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
import { Colors } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';

const c = Colors;

const CreateMatchSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
  location: z.string().min(3, 'La ubicación debe tener al menos 3 caracteres'),
  dateText: z.string().min(1, 'Debes indicar la fecha del partido'),
  timeText: z.string().min(1, 'Debes indicar la hora del partido'),
  totalPlayers: z.number().min(1, 'Debes solicitar al menos 1 jugador en las posiciones'),
  price: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 0, 'El precio no es válido'),
});

const LEVELS = [
  { key: 'tranquilo',   label: 'Tranquilo',   emoji: '😌', color: '#22C55E' },
  { key: 'medio',       label: 'Medio',       emoji: '⚽', color: '#F59E0B' },
  { key: 'competitivo', label: 'Competitivo', emoji: '🔥', color: '#EF4444' },
];

const inp = {
  backgroundColor: 'rgba(255,255,255,0.04)' as const,
  borderColor: 'rgba(255,255,255,0.08)' as const,
  borderWidth: 1,
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 13,
  color: c.text,
  fontSize: 15,
};

const lbl = {
  fontSize: 11,
  fontWeight: '600' as const,
  color: c.textDim,
  marginBottom: 6,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
};

const sectionCard = {
  backgroundColor: c.bgElev,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: c.border,
  padding: 18,
  marginBottom: 14,
};

export default function CreateMatchScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationCity, setLocationCity] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<MatchLevel>('medio');

  const [dateObj, setDateObj] = useState(new Date());
  const [dateText, setDateText] = useState('');
  const [timeText, setTimeText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [positions, setPositions] = useState({
    portero: 0, defensa: 0, mediocentro: 0, delantero: 0, cualquiera: 0,
  });

  const [teamAColor, setTeamAColor] = useState('#EF4444');
  const [teamBColor, setTeamBColor] = useState('#3B82F6');
  const presetColors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#111827', '#FFFFFF'];

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
      setDateObj(selectedDate);
      if (Platform.OS === 'android') {
        const d = selectedDate;
        setDateText(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
      }
    }
  };

  const confirmDateIOS = () => {
    setShowDatePicker(false);
    const d = dateObj;
    setDateText(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
  };

  const onTimePickerChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selectedDate) {
      setDateObj(selectedDate);
      if (Platform.OS === 'android') {
        setTimeText(`${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`);
      }
    }
  };

  const confirmTimeIOS = () => {
    setShowTimePicker(false);
    setTimeText(`${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`);
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

  const PickerModal = ({ visible, title: t, onCancel, onConfirm, children }: any) => (
    <Modal transparent animationType="slide" visible={visible}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <View style={{ backgroundColor: c.bgElev, paddingBottom: 40, paddingTop: 16, paddingHorizontal: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 12 }}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={{ color: c.danger, fontWeight: '600', fontSize: 16 }}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{t}</Text>
            <TouchableOpacity onPress={onConfirm}>
              <Text style={{ color: c.brand, fontWeight: '700', fontSize: 16 }}>Confirmar</Text>
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={{ fontSize: 10, fontWeight: '700', color: c.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
          NUEVO
        </Text>
        <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 28, fontWeight: '900', color: c.text, letterSpacing: -0.5, marginBottom: 24 }}>
          Crear Partido
        </Text>

        {/* 1. Información General */}
        <View style={sectionCard}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: c.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Información
          </Text>
          <View style={{ gap: 14 }}>
            <View>
              <Text style={lbl}>Título del Partido</Text>
              <TextInput style={inp} placeholder="Fútbol-7 Jueves Tarde" placeholderTextColor={c.textMuted} value={title} onChangeText={setTitle} />
            </View>
            <View>
              <Text style={lbl}>Ubicación</Text>
              <UbicacionInput
                value={location}
                onChangeText={setLocation}
                onSelect={(r: GeoResult) => {
                  const label = [r.nombre, r.direccion, r.ciudad].filter(Boolean).join(', ');
                  setLocation(label); setLocationLat(r.lat); setLocationLng(r.lng); setLocationCity(r.ciudad);
                }}
              />
            </View>
            <View>
              <Text style={lbl}>Descripción</Text>
              <TextInput
                style={{ ...inp, minHeight: 80, textAlignVertical: 'top' }}
                placeholder="Buen ambiente, nivel medio, cervezas después de jugar"
                placeholderTextColor={c.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        </View>

        {/* 2. Nivel */}
        <View style={sectionCard}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: c.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Nivel del Partido
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {LEVELS.map(l => {
              const isActive = level === l.key;
              return (
                <TouchableOpacity
                  key={l.key}
                  onPress={() => setLevel(l.key as MatchLevel)}
                  style={{
                    flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center', borderWidth: 2,
                    backgroundColor: isActive ? l.color + '22' : 'rgba(255,255,255,0.03)',
                    borderColor: isActive ? l.color : c.border,
                  }}
                >
                  <Text style={{ fontSize: 22, marginBottom: 4 }}>{l.emoji}</Text>
                  <Text style={{ fontWeight: '700', fontSize: 12, color: isActive ? l.color : c.textDim }}>{l.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 3. Fecha y Hora */}
        <View style={sectionCard}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: c.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Cuándo jugamos
          </Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={lbl}>Día</Text>
              <TouchableOpacity
                style={{ ...inp, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                onPress={() => { if (Platform.OS !== 'web') setShowDatePicker(true); }}
                activeOpacity={Platform.OS === 'web' ? 1 : 0.7}
              >
                {Platform.OS !== 'web' ? (
                  <>
                    <Text style={{ color: dateText ? c.text : c.textMuted, fontSize: 15 }}>{dateText || 'DD/MM/YYYY'}</Text>
                    <Ionicons name="calendar-outline" size={18} color={c.brand} />
                  </>
                ) : (
                  <TextInput
                    style={{ flex: 1, color: c.text }}
                    placeholder="05/04/2026"
                    placeholderTextColor={c.textMuted}
                    value={dateText}
                    onChangeText={handleDateChangeText}
                    keyboardType="numeric"
                    maxLength={10}
                  />
                )}
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={lbl}>Hora</Text>
              <TouchableOpacity
                style={{ ...inp, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                onPress={() => { if (Platform.OS !== 'web') setShowTimePicker(true); }}
                activeOpacity={Platform.OS === 'web' ? 1 : 0.7}
              >
                {Platform.OS !== 'web' ? (
                  <>
                    <Text style={{ color: timeText ? c.text : c.textMuted, fontSize: 15 }}>{timeText || 'HH:MM'}</Text>
                    <Ionicons name="time-outline" size={18} color={c.brand} />
                  </>
                ) : (
                  <TextInput
                    style={{ flex: 1, color: c.text }}
                    placeholder="20:00"
                    placeholderTextColor={c.textMuted}
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
            <DateTimePicker value={dateObj} mode="date" display="spinner" onChange={onDatePickerChange} minimumDate={new Date()} locale="es-ES" />
          </PickerModal>
        )}
        {Platform.OS === 'android' && showTimePicker && (
          <DateTimePicker value={dateObj} mode="time" display="default" onChange={onTimePickerChange} is24Hour locale="es-ES" />
        )}
        {Platform.OS === 'ios' && (
          <PickerModal visible={showTimePicker} title="Hora del partido" onCancel={() => setShowTimePicker(false)} onConfirm={confirmTimeIOS}>
            <DateTimePicker value={dateObj} mode="time" display="spinner" onChange={onTimePickerChange} is24Hour locale="es-ES" />
          </PickerModal>
        )}

        {/* 4. Posiciones */}
        <View style={sectionCard}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: c.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Jugadores necesarios
          </Text>
          {[
            { key: 'portero',     label: 'Porteros',          emoji: '🧤' },
            { key: 'defensa',     label: 'Defensas',          emoji: '🛡️' },
            { key: 'mediocentro', label: 'Medios',            emoji: '⚙️' },
            { key: 'delantero',   label: 'Delanteros',        emoji: '⚡' },
            { key: 'cualquiera',  label: 'Cualquier posición', emoji: '👟' },
          ].map((pos) => (
            <View key={pos.key} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 20 }}>{pos.emoji}</Text>
                <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>{pos.label}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TouchableOpacity
                  onPress={() => updatePosition(pos.key as PositionKey, -1)}
                  style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.bgSurface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="remove" size={18} color={c.textDim} />
                </TouchableOpacity>
                <Text style={{ minWidth: 36, textAlign: 'center', fontWeight: '800', fontSize: 18, color: c.text }}>
                  {positions[pos.key as PositionKey]}
                </Text>
                <TouchableOpacity
                  onPress={() => updatePosition(pos.key as PositionKey, 1)}
                  style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.brandSoft, borderWidth: 1, borderColor: c.brand + '44', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Ionicons name="add" size={18} color={c.brand} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <Text style={{ color: c.textDim, fontWeight: '600', fontSize: 13 }}>Total jugadores</Text>
            <View style={{ backgroundColor: c.brand, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100 }}>
              <Text style={{ fontWeight: '800', color: '#fff', fontSize: 16 }}>{totalPlayers}</Text>
            </View>
          </View>
        </View>

        {/* 5. Colores de Equipos */}
        <View style={sectionCard}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: c.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Colores de Camiseta
          </Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            {[
              { label: 'Equipo A', color: teamAColor, setColor: setTeamAColor, prefix: 'a' },
              { label: 'Equipo B', color: teamBColor, setColor: setTeamBColor, prefix: 'b' },
            ].map(team => (
              <View key={team.prefix} style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: team.color, borderWidth: 2, borderColor: c.brand }} />
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 13 }}>{team.label}</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {presetColors.map(col => (
                    <TouchableOpacity
                      key={`${team.prefix}-${col}`}
                      onPress={() => team.setColor(col)}
                      style={{
                        width: 30, height: 30, borderRadius: 8, backgroundColor: col,
                        borderWidth: 2, borderColor: team.color === col ? c.brand : c.border,
                      }}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 6. Extra */}
        <View style={sectionCard}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: c.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Configuración
          </Text>
          <View style={{ gap: 16 }}>
            <View>
              <Text style={lbl}>Precio por persona (€)</Text>
              <TextInput
                style={inp}
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={c.textMuted}
              />
              <Text style={{ fontSize: 10, color: c.textMuted, marginTop: 4 }}>
                El organizador gestiona el cobro manualmente.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={{ color: c.text, fontWeight: '600', fontSize: 14 }}>Aprobar jugadores manualmente</Text>
                <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 2 }}>El organizador revisa cada solicitud</Text>
              </View>
              <Switch
                value={requiresApproval}
                onValueChange={setRequiresApproval}
                trackColor={{ false: c.border, true: c.brand }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            disabled={loading}
            style={{ flex: 1, backgroundColor: c.bgElev, borderWidth: 1, borderColor: c.border, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text style={{ color: c.textDim, fontWeight: '700', fontSize: 15 }}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading}
            style={{ flex: 2, backgroundColor: c.brand, borderRadius: 16, paddingVertical: 16, alignItems: 'center', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Publicar
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
