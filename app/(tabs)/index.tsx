import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { PendingReviewsAlert } from '@/components/PendingReviewsAlert';
import { HomeHero } from '@/components/rondo/HomeHero';
import { SearchCard } from '@/components/rondo/SearchCard';
import { reverseGeocodeCiudad, type GeoResult } from '@/lib/geocoding';
import { Colors } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [ciudadLabel, setCiudadLabel] = useState('');
  const [ciudadLat, setCiudadLat] = useState<number | null>(null);
  const [ciudadLng, setCiudadLng] = useState<number | null>(null);
  const [ciudadPreset, setCiudadPreset] = useState<GeoResult | null>(null);
  const [position, setPosition] = useState('cualquiera');
  const [searchDate, setSearchDate] = useState(new Date());

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const result = await reverseGeocodeCiudad(loc.coords.latitude, loc.coords.longitude);
        if (result) {
          setCiudadLabel(result.ciudad);
          setCiudadLat(result.lat);
          setCiudadLng(result.lng);
          setCiudadPreset(result);
        }
      } catch {
        // GPS denied or failed — user can enter manually
      }
    })();
  }, []);

  const buildDateString = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${date.getFullYear()}`;
  };

  const handleSearch = (presetDate?: Date) => {
    if (!ciudadLat || !ciudadLng) {
      Alert.alert('Ubicación requerida', 'Selecciona una ciudad para buscar partidos.');
      return;
    }
    const params: Record<string, string> = {
      lat: String(ciudadLat),
      lng: String(ciudadLng),
      ciudad: ciudadLabel,
      date: buildDateString(presetDate ?? searchDate),
    };
    if (position !== 'cualquiera') params.position = position;
    router.push({ pathname: '/search/results', params });
  };

  const handleQuickAction = (mode: 'tomorrow' | 'this_week' | 'next_week') => {
    if (!ciudadLat || !ciudadLng) {
      Alert.alert('Ubicación requerida', 'Selecciona una ciudad para buscar partidos.');
      return;
    }
    if (mode === 'tomorrow') {
      const target = new Date();
      target.setDate(target.getDate() + 1);
      handleSearch(target);
    } else {
      const params: Record<string, string> = { dateRange: mode, lat: String(ciudadLat), lng: String(ciudadLng), ciudad: ciudadLabel };
      if (position !== 'cualquiera') params.position = position;
      router.push({ pathname: '/search/results', params });
    }
  };

  const c = Colors;

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
            onSearch={() => handleSearch()}
            onQuickAction={handleQuickAction}
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
