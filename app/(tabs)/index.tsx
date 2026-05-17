import React, { useState } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { PendingReviewsAlert } from '@/components/PendingReviewsAlert';
import { HomeHero } from '@/components/rondo/HomeHero';
import { SearchCard } from '@/components/rondo/SearchCard';
import { reverseGeocodeCiudad, type GeoResult } from '@/lib/geocoding';
import { saveUserLocationPreference } from '@/lib/notifications';
import { useTheme } from '@/hooks/use-theme';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();

  const [ciudadLabel, setCiudadLabel] = useState('');
  const [ciudadLat, setCiudadLat] = useState<number | null>(null);
  const [ciudadLng, setCiudadLng] = useState<number | null>(null);
  const [ciudadPreset, setCiudadPreset] = useState<GeoResult | null>(null);
  const [position, setPosition] = useState('cualquiera');
  const [searchDate, setSearchDate] = useState(new Date());

  const fillCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const result = await reverseGeocodeCiudad(loc.coords.latitude, loc.coords.longitude);
      if (!result) return null;
      setCiudadLabel(result.ciudad);
      setCiudadLat(result.lat);
      setCiudadLng(result.lng);
      setCiudadPreset(result);
      return result;
    } catch {
      return null;
    }
  };

  const buildDateString = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${date.getFullYear()}`;
  };

  const getSearchLocation = async () => {
    if (ciudadLat && ciudadLng) {
      return { label: ciudadLabel, lat: ciudadLat, lng: ciudadLng };
    }

    const result = await fillCurrentLocation();
    if (!result) return null;
    return { label: result.ciudad, lat: result.lat, lng: result.lng };
  };

  const pushSearch = (
    location: { label: string; lat: number; lng: number },
    date: Date,
  ) => {
    void saveUserLocationPreference({
      city: location.label,
      latitude: location.lat,
      longitude: location.lng,
    });

    const params: Record<string, string> = {
      lat: String(location.lat),
      lng: String(location.lng),
      ciudad: location.label,
      date: buildDateString(date),
    };
    if (position !== 'cualquiera') params.position = position;
    router.push({ pathname: '/search/results', params });
  };

  const handleSearch = async (presetDate?: Date) => {
    const location = await getSearchLocation();
    if (!location) {
      Alert.alert('Ubicación requerida', 'Selecciona una ciudad para buscar partidos.');
      return;
    }

    pushSearch(location, presetDate ?? searchDate);
  };

  const handleQuickAction = async (mode: 'tomorrow' | 'this_week' | 'next_week') => {
    const location = await getSearchLocation();
    if (!location) {
      Alert.alert('Ubicación requerida', 'Selecciona una ciudad para buscar partidos.');
      return;
    }

    if (mode === 'tomorrow') {
      const target = new Date();
      target.setDate(target.getDate() + 1);
      pushSearch(location, target);
    } else {
      void saveUserLocationPreference({
        city: location.label,
        latitude: location.lat,
        longitude: location.lng,
      });

      const params: Record<string, string> = { dateRange: mode, lat: String(location.lat), lng: String(location.lng), ciudad: location.label };
      if (position !== 'cualquiera') params.position = position;
      router.push({ pathname: '/search/results', params });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: FLOATING_TAB_BAR_HEIGHT + insets.bottom + 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <HomeHero />

        <View style={{ position: 'relative', zIndex: 20 }}>
          <SearchCard
            ciudadLabel={ciudadLabel}
            ciudadPreset={ciudadPreset}
            position={position}
            searchDate={searchDate}
            onCiudadSelect={(r: GeoResult) => {
              setCiudadLabel(r.ciudad);
              setCiudadLat(r.lat);
              setCiudadLng(r.lng);
              setCiudadPreset(null);
            }}
            onCiudadClear={() => { setCiudadLabel(''); setCiudadLat(null); setCiudadLng(null); setCiudadPreset(null); }}
            onPositionChange={setPosition}
            onDateChange={setSearchDate}
            onSearch={() => { void handleSearch(); }}
            onQuickAction={(mode) => { void handleQuickAction(mode); }}
          />
        </View>

        <View style={{ marginTop: 16, paddingHorizontal: 14, position: 'relative', zIndex: 1 }}>
          <PendingReviewsAlert />
        </View>

        {/* Create match banner */}
        <View style={{
          marginHorizontal: 14, marginTop: 16,
          backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 20,
          padding: 20, borderWidth: 1, borderColor: 'rgba(34,197,94,0.20)',
        }}>
          <View style={{ backgroundColor: c.brand, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, marginBottom: 10 }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
              Conecta y Juega
            </Text>
          </View>
          <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 20, fontWeight: '900', color: c.text, marginBottom: 8 }}>
            ¿No encuentras{'\n'}lo que buscas?
          </Text>
          <Text style={{ fontSize: 13, color: c.textDim, lineHeight: 20, marginBottom: 16 }}>
            Organiza tu propio partido, elige el nivel y nosotros te ayudamos a encontrar a los jugadores que faltan.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/create')}
            style={{
              backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 12,
              padding: 14, borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)',
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>¡Publicar un partido ahora!</Text>
            <Text style={{ color: c.brand, fontSize: 18 }}>→</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
