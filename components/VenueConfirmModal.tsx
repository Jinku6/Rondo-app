import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Colors } from '@/constants/theme';
import { buscarDireccionTemporal, type GeoResult } from '@/lib/geocoding';

interface Props {
  visible: boolean;
  title: string;
  name: string;
  address?: string | null;
  city?: string | null;
  latitude: number;
  longitude: number;
  editableName?: boolean;
  requireCity?: boolean;
  confirmLoading?: boolean;
  onCancel: () => void;
  onConfirm: (value: { name: string; address: string; latitude: number; longitude: number; city: string }) => void;
}

export function VenueConfirmModal({
  visible,
  title,
  name,
  address,
  city,
  latitude,
  longitude,
  editableName,
  requireCity,
  confirmLoading,
  onCancel,
  onConfirm,
}: Props) {
  const [nameText, setNameText] = useState(name);
  const [addressText, setAddressText] = useState(address || '');
  const [addressResults, setAddressResults] = useState<GeoResult[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [latText, setLatText] = useState(String(latitude));
  const [lngText, setLngText] = useState(String(longitude));
  const [cityText, setCityText] = useState(city || '');
  const addressTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const c = Colors;

  useEffect(() => {
    setNameText(name);
    setAddressText(address || '');
    setAddressResults([]);
    setLatText(String(latitude));
    setLngText(String(longitude));
    setCityText(city || '');
  }, [latitude, longitude, name, address, city, visible]);

  useEffect(() => {
    return () => {
      if (addressTimeoutRef.current) clearTimeout(addressTimeoutRef.current);
    };
  }, []);

  const handleAddressChange = (text: string) => {
    setAddressText(text);
    if (addressTimeoutRef.current) clearTimeout(addressTimeoutRef.current);

    if (text.trim().length < 3) {
      setAddressResults([]);
      return;
    }

    addressTimeoutRef.current = setTimeout(async () => {
      setAddressLoading(true);
      try {
        const parsedLat = Number(latText);
        const parsedLng = Number(lngText);
        const results = await buscarDireccionTemporal(
          text,
          Number.isFinite(parsedLat) && Number.isFinite(parsedLng)
            ? { latitude: parsedLat, longitude: parsedLng }
            : undefined
        );
        setAddressResults(results);
      } catch {
        setAddressResults([]);
      } finally {
        setAddressLoading(false);
      }
    }, 500);
  };

  const handleAddressSelect = (result: GeoResult) => {
    setAddressText(result.direccion || result.nombre);
    setCityText(result.ciudad);
    setLatText(String(result.lat));
    setLngText(String(result.lng));
    setAddressResults([]);
  };

  const parsedLat = Number(latText);
  const parsedLng = Number(lngText);
  const canConfirm =
    nameText.trim().length >= 3 &&
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng) &&
    (!requireCity || cityText.trim().length > 1);
  const confirmDisabled = !canConfirm || !!confirmLoading;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.70)' }}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
            >
              <View style={{ backgroundColor: c.bgElev, padding: 18, paddingBottom: 24, borderTopLeftRadius: 22, borderTopRightRadius: 22, gap: 12 }}>
                <Text style={{ color: c.text, fontSize: 18, fontWeight: '900' }}>{title}</Text>

                <TextInput
                  value={nameText}
                  editable={!!editableName}
                  onChangeText={setNameText}
                  placeholder="Nombre del campo"
                  placeholderTextColor={c.textMuted}
                  style={{ minHeight: 44, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12, opacity: editableName ? 1 : 0.75 }}
                />

                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TextInput
                      value={addressText}
                      onChangeText={handleAddressChange}
                      placeholder="Direccion o calle"
                      placeholderTextColor={c.textMuted}
                      style={{ flex: 1, minHeight: 44, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12 }}
                    />
                    {addressLoading && <ActivityIndicator size="small" color={c.brand} style={{ marginLeft: 8 }} />}
                  </View>
                  {addressResults.length > 0 && (
                    <View style={{ marginTop: 6, borderWidth: 1, borderColor: c.border, borderRadius: 12, overflow: 'hidden' }}>
                      {addressResults.map((item, index) => (
                        <TouchableOpacity
                          key={`${item.direccion}-${item.lat}-${item.lng}-${index}`}
                          onPress={() => handleAddressSelect(item)}
                          style={{ padding: 10, borderBottomWidth: index < addressResults.length - 1 ? 1 : 0, borderBottomColor: c.border }}
                        >
                          <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                            {item.direccion || item.nombre}
                          </Text>
                          {!!item.ciudad && (
                            <Text style={{ color: c.textDim, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                              {item.ciudad}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

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
                    onPress={() => {
                      Keyboard.dismiss();
                      onCancel();
                    }}
                    disabled={!!confirmLoading}
                    style={{ flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: c.border, opacity: confirmLoading ? 0.5 : 1 }}
                  >
                    <Text style={{ color: c.textDim, fontWeight: '800' }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={confirmDisabled}
                    onPress={() => {
                      Keyboard.dismiss();
                      onConfirm({
                        name: nameText.trim(),
                        address: addressText.trim(),
                        latitude: parsedLat,
                        longitude: parsedLng,
                        city: cityText.trim(),
                      });
                    }}
                    style={{
                      flex: 2,
                      minHeight: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 14,
                      backgroundColor: c.brand,
                      opacity: confirmDisabled ? 0.45 : 1,
                    }}
                  >
                    {confirmLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '900' }}>Confirmar ubicacion</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}
