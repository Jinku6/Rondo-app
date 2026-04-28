import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Modal } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { CiudadInput } from '@/components/CiudadInput';
import { Chip } from '@/components/ui/Chip';
import type { GeoResult } from '@/lib/geocoding';
import { useTheme } from '@/hooks/use-theme';

interface SearchCardProps {
  ciudadLabel: string;
  ciudadPreset: GeoResult | null;
  position: string;
  searchDate: Date;
  onCiudadSelect: (result: GeoResult) => void;
  onCiudadClear: () => void;
  onPositionChange: (pos: string) => void;
  onDateChange: (date: Date) => void;
  onSearch: () => void;
  onQuickAction: (mode: 'tomorrow' | 'this_week' | 'next_week') => void;
}

const POSITIONS = [
  { id: 'cualquiera', label: 'Cualquier posición' },
  { id: 'portero', label: 'Portero' },
  { id: 'defensa', label: 'Defensa' },
  { id: 'mediocentro', label: 'Mediocentro' },
  { id: 'delantero', label: 'Delantero' },
];

const QUICK_ACTIONS = [
  { id: 'tomorrow', label: 'Mañana' },
  { id: 'this_week', label: 'Esta semana' },
  { id: 'next_week', label: 'Próx. semana' },
];

export const SearchCard: React.FC<SearchCardProps> = ({
  ciudadLabel, ciudadPreset, position, searchDate,
  onCiudadSelect, onCiudadClear, onPositionChange, onDateChange, onSearch, onQuickAction,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { colors, radius, shadows } = useTheme();

  const getDateText = () =>
    searchDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  const handleDateChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) onDateChange(selectedDate);
  };

  return (
    <View
      style={{
        marginHorizontal: 14,
        marginTop: -20,
        backgroundColor: colors.bgElev,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        ...shadows.md,
        zIndex: 10,
        overflow: 'hidden',
      }}
    >
      {/* Location row */}
      <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: colors.textDim, marginBottom: 6 }}>
          Ubicación
        </Text>
        <CiudadInput
          value={ciudadLabel}
          presetResult={ciudadPreset}
          onSelect={onCiudadSelect}
          onClear={onCiudadClear}
        />
      </View>

      {/* Position chips */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingVertical: 10 }}
        >
          {POSITIONS.map((pos) => (
            <Chip
              key={pos.id}
              label={pos.label}
              selected={position === pos.id}
              onPress={() => onPositionChange(pos.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Date row */}
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.brand} />
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.text, textTransform: 'capitalize' }}>
            {getDateText()}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <View style={{ flexDirection: 'row', gap: 6, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {QUICK_ACTIONS.map((action) => (
          <Chip
            key={action.id}
            label={action.label}
            variant="action"
            onPress={() => onQuickAction(action.id as any)}
            style={{ flex: 1 }}
          />
        ))}
      </View>

      {/* Search CTA */}
      <TouchableOpacity
        onPress={onSearch}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.brand }}
      >
        <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 15, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase', color: '#fff' }}>
          Buscar Partidos
        </Text>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Date Picker */}
      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker value={searchDate} mode="date" display="default" onChange={handleDateChange} minimumDate={new Date()} locale="es-ES" />
      )}
      {Platform.OS === 'ios' && showDatePicker && (
        <Modal transparent animationType="slide" visible={showDatePicker}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: colors.bgElev, paddingBottom: 40, paddingTop: 16, paddingHorizontal: 16, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 16 }}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>Fecha</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Text style={{ color: colors.brand, fontWeight: '700', fontSize: 16 }}>Confirmar</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker value={searchDate} mode="date" display="spinner" onChange={handleDateChange} minimumDate={new Date()} locale="es-ES" />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};
