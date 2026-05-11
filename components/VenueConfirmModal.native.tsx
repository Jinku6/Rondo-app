import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import Constants from 'expo-constants';
import MapView, { Marker } from 'react-native-maps';
import { Colors } from '@/constants/theme';
import { buscarDireccionTemporal, reverseGeocodeDireccion, type GeoResult } from '@/lib/geocoding';

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
  const [reverseLoading, setReverseLoading] = useState(false);
  const [pin, setPin] = useState({ latitude, longitude });
  const [latText, setLatText] = useState(String(latitude));
  const [lngText, setLngText] = useState(String(longitude));
  const [cityText, setCityText] = useState(city || '');
  const addressTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const c = Colors;
  const canRenderMap = Platform.OS !== 'android' || Constants.expoConfig?.extra?.androidGoogleMapsConfigured === true;

  useEffect(() => {
    setNameText(name);
    setAddressText(address || '');
    setAddressResults([]);
    setPin({ latitude, longitude });
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
        const results = await buscarDireccionTemporal(text, pin);
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
    setPin({ latitude: result.lat, longitude: result.lng });
    setLatText(String(result.lat));
    setLngText(String(result.lng));
    setAddressResults([]);
  };

  const handlePinChange = async (coordinate: { latitude: number; longitude: number }) => {
    setPin(coordinate);
    setLatText(String(coordinate.latitude));
    setLngText(String(coordinate.longitude));
    setAddressResults([]);
    setReverseLoading(true);
    try {
      const result = await reverseGeocodeDireccion(coordinate.latitude, coordinate.longitude);
      if (result) {
        setAddressText(result.direccion || result.nombre);
        setCityText(result.ciudad);
      }
    } catch (error) {
      Alert.alert('No se pudo actualizar la direccion', error instanceof Error ? error.message : String(error));
    } finally {
      setReverseLoading(false);
    }
  };

  const handlePoiClick = async (event: any) => {
    const { coordinate, name: poiName } = event.nativeEvent;
    if (!coordinate) return;

    Keyboard.dismiss();
    setNameText(poiName || nameText);
    setPin(coordinate);
    setAddressResults([]);
    setReverseLoading(true);
    try {
      const result = await reverseGeocodeDireccion(coordinate.latitude, coordinate.longitude);
      if (result) {
        setAddressText(result.direccion || result.nombre);
        setCityText(result.ciudad);
      }
    } catch (error) {
      Alert.alert('No se pudo cargar la direccion del lugar', error instanceof Error ? error.message : String(error));
    } finally {
      setReverseLoading(false);
    }
  };

  const canConfirm = nameText.trim().length >= 3 && (!requireCity || cityText.trim().length > 1);
  const parsedLat = Number(latText);
  const parsedLng = Number(lngText);
  const coordinatesAreValid = Number.isFinite(parsedLat) && Number.isFinite(parsedLng);
  const confirmDisabled = !canConfirm || !coordinatesAreValid || !!confirmLoading;

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
                    {(addressLoading || reverseLoading) && <ActivityIndicator size="small" color={c.brand} style={{ marginLeft: 8 }} />}
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

                {canRenderMap ? (
                  <View style={{ height: 220, overflow: 'hidden', borderRadius: 16, borderWidth: 1, borderColor: c.border }}>
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
                      onPress={(event: any) => {
                        Keyboard.dismiss();
                        handlePinChange(event.nativeEvent.coordinate);
                      }}
                      onPoiClick={Platform.OS === 'android' ? handlePoiClick : undefined}
                      poiClickEnabled={Platform.OS === 'android'}
                    >
                      <Marker
                        draggable
                        coordinate={pin}
                        title={nameText}
                        onDragEnd={(event: any) => handlePinChange(event.nativeEvent.coordinate)}
                      />
                    </MapView>
                  </View>
                ) : (
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
                )}

                <TextInput
                  value={cityText}
                  onChangeText={setCityText}
                  placeholder="Ciudad"
                  placeholderTextColor={c.textMuted}
                  style={{ minHeight: 44, color: c.text, borderWidth: 1, borderColor: c.border, borderRadius: 12, paddingHorizontal: 12 }}
                />
                <Text style={{ color: c.textMuted, fontSize: 11 }}>
                  Mueve el pin si la ubicacion no esta exacta. La direccion se actualiza con el pin.
                </Text>

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
                      <Text style={{ color: '#fff', fontWeight: '900' }}>Crear ubicacion</Text>
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
