import React, { useEffect, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
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
  const [pin, setPin] = useState({ latitude, longitude });
  const [cityText, setCityText] = useState(city || '');
  const c = Colors;

  useEffect(() => {
    setPin({ latitude, longitude });
    setCityText(city || '');
  }, [latitude, longitude, city, visible]);

  const canConfirm = !requireCity || cityText.trim().length > 1;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.70)' }}>
        <View style={{ backgroundColor: c.bgElev, padding: 18, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 12 }}>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>{title}</Text>
          <Text style={{ color: c.textDim, fontSize: 13 }}>{name}</Text>

          <View style={{ height: 260, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: c.border }}>
            <MapView
              style={{ flex: 1 }}
              initialRegion={{
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              region={{
                latitude: pin.latitude,
                longitude: pin.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={(event) => setPin(event.nativeEvent.coordinate)}
            >
              <Marker
                draggable
                coordinate={pin}
                title={name}
                onDragEnd={(event) => setPin(event.nativeEvent.coordinate)}
              />
            </MapView>
          </View>

          <TextInput
            value={cityText}
            onChangeText={setCityText}
            placeholder="Ciudad"
            placeholderTextColor={c.textMuted}
            style={{ minHeight: 44, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12 }}
          />
          <Text style={{ color: c.textMuted, fontSize: 11 }}>
            Mueve el pin si la ubicación no está exacta.
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              onPress={onCancel}
              style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.border }}
            >
              <Text style={{ color: c.textDim, fontWeight: '800' }}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!canConfirm}
              onPress={() => onConfirm({ latitude: pin.latitude, longitude: pin.longitude, city: cityText.trim() })}
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
