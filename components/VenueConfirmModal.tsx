import React, { useEffect, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '@/constants/theme';

interface Props {
  visible: boolean;
  title: string;
  name: string;
  city?: string | null;
  latitude: number;
  longitude: number;
  requireCity?: boolean;
  onCancel: () => void;
  onConfirm: (value: { latitude: number; longitude: number; city: string }) => void;
}

export function VenueConfirmModal({
  visible,
  title,
  name,
  city,
  latitude,
  longitude,
  requireCity,
  onCancel,
  onConfirm,
}: Props) {
  const [latText, setLatText] = useState(String(latitude));
  const [lngText, setLngText] = useState(String(longitude));
  const [cityText, setCityText] = useState(city || '');
  const c = Colors;

  useEffect(() => {
    setLatText(String(latitude));
    setLngText(String(longitude));
    setCityText(city || '');
  }, [latitude, longitude, city, visible]);

  const parsedLat = Number(latText);
  const parsedLng = Number(lngText);
  const canConfirm =
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng) &&
    (!requireCity || cityText.trim().length > 1);

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.70)' }}>
        <View style={{ backgroundColor: c.bgElev, padding: 18, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 12 }}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>{title}</Text>
          <Text style={{ color: c.textDim, fontSize: 13 }}>{name}</Text>

          <TextInput
            value={cityText}
            onChangeText={setCityText}
            placeholder="Ciudad"
            placeholderTextColor={c.textMuted}
            style={{ minHeight: 44, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12 }}
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              value={latText}
              onChangeText={setLatText}
              keyboardType="numeric"
              placeholder="Latitud"
              placeholderTextColor={c.textMuted}
              style={{ flex: 1, minHeight: 44, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12 }}
            />
            <TextInput
              value={lngText}
              onChangeText={setLngText}
              keyboardType="numeric"
              placeholder="Longitud"
              placeholderTextColor={c.textMuted}
              style={{ flex: 1, minHeight: 44, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12 }}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.border }}
            >
              <Text style={{ color: c.textDim, fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!canConfirm}
              onPress={() => onConfirm({ latitude: parsedLat, longitude: parsedLng, city: cityText.trim() })}
              style={{
                flex: 2,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 14,
                backgroundColor: c.brand,
                opacity: canConfirm ? 1 : 0.45,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '900' }}>Confirmar ubicación</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
