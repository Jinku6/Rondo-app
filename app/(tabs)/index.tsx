import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Image, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/AuthContext';
import { PendingReviewsAlert } from '@/components/PendingReviewsAlert';
import { CiudadInput } from '@/components/CiudadInput';
import { reverseGeocodeCiudad, type GeoResult } from '@/lib/geocoding';

export default function SearchScreen() {
  const router = useRouter();
  const { profile } = useAuth();

  const [ciudadLabel, setCiudadLabel] = useState('');
  const [ciudadLat, setCiudadLat] = useState<number | null>(null);
  const [ciudadLng, setCiudadLng] = useState<number | null>(null);
  const [ciudadPreset, setCiudadPreset] = useState<GeoResult | null>(null);
  const [position, setPosition] = useState('cualquiera');

  const [searchDate, setSearchDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Obtener ubicación GPS al montar la pantalla
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const resultado = await reverseGeocodeCiudad(loc.coords.latitude, loc.coords.longitude);
        if (resultado) {
          setCiudadLabel(resultado.ciudad);
          setCiudadLat(resultado.lat);
          setCiudadLng(resultado.lng);
          setCiudadPreset(resultado);
        }
      } catch {
        // Permiso denegado o error de GPS — el campo queda disponible para entrada manual
      }
    })();
  }, []);

  const handleSearch = (presetDate?: Date) => {
    if (!ciudadLat || !ciudadLng) {
      Alert.alert('Ubicación requerida', 'Selecciona una ciudad para buscar partidos.');
      return;
    }
    let params: any = {};
    params.lat = String(ciudadLat);
    params.lng = String(ciudadLng);
    params.ciudad = ciudadLabel;
    if (position !== 'cualquiera') params.position = position;

    const targetDate = presetDate || searchDate;
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const yyyy = targetDate.getFullYear();
    params.date = `${dd}/${mm}/${yyyy}`;

    router.push({ pathname: '/search/results', params });
  };

  const handleQuickAction = (daysToAdd: number, toEndOfWeek: boolean = false) => {
    if (!ciudadLat || !ciudadLng) {
      Alert.alert('Ubicación requerida', 'Selecciona una ciudad para buscar partidos.');
      return;
    }
    const today = new Date();
    if (toEndOfWeek) {
      const params: any = { dateRange: 'this_week', lat: String(ciudadLat), lng: String(ciudadLng), ciudad: ciudadLabel };
      if (position !== 'cualquiera') params.position = position;
      router.push({ pathname: '/search/results', params });
    } else {
      const target = new Date();
      target.setDate(today.getDate() + daysToAdd);
      handleSearch(target);
    }
  };

  const onDateChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) setSearchDate(selectedDate);
  };

  const getDateDisplayText = () => {
    return searchDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-neutral-950" edges={['top']}>
      <ScrollView className="flex-1 border-t border-slate-200 dark:border-neutral-950"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled">
      
      {/* Cabecera BlaBlaCar style */}
      <View className="px-6 pt-10 pb-4 flex-row items-center">
        <Image 
          source={require('@/assets/images/icon.png')} 
          className="w-12 h-12 rounded-xl mr-3"
          resizeMode="cover"
        />
        <Text className="text-slate-900 dark:text-white text-3xl font-bold">
          ¡Hola, {profile?.full_name?.split(' ')[0] || 'Jugador'}!
        </Text>
      </View>
      <View className="px-6 pb-8">
        <Text className="text-slate-900 dark:text-white text-4xl font-black leading-tight">
          Encuentra tu próximo{'\n'}partido de fútbol,{'\n'}a tu manera con Rondo.
        </Text>
      </View>

      {/* Formulario Buscador Azul Flotante */}
      <View className="mx-4 bg-white dark:bg-gray-900 rounded-2xl p-5 border border-slate-200 dark:border-green-500/30 shadow-sm">
        
        {/* Campo Ubicación */}
        <View className="pb-4 border-b border-slate-100 dark:border-gray-800">
          <CiudadInput
            value={ciudadLabel}
            presetResult={ciudadPreset}
            onSelect={(r: GeoResult) => {
              setCiudadLabel(r.ciudad);
              setCiudadLat(r.lat);
              setCiudadLng(r.lng);
              setCiudadPreset(null);
            }}
            onClear={() => {
              setCiudadLabel('');
              setCiudadLat(null);
              setCiudadLng(null);
              setCiudadPreset(null);
            }}
          />
        </View>

        {/* Filtro Posicion */}
        <View className="flex-row items-center pt-2 pb-4 border-b border-slate-100 dark:border-gray-800">
          <Ionicons name="shirt-outline" size={24} color="#94a3b8" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="ml-4 flex-row">
            {['cualquiera', 'portero', 'defensa', 'mediocentro', 'delantero'].map(pos => (
              <TouchableOpacity 
                key={pos}
                onPress={() => setPosition(pos)}
                className={`mr-2 px-4 py-2 rounded-full border ${position === pos ? 'bg-green-50 dark:bg-green-500/20 border-green-500' : 'bg-slate-50 dark:bg-gray-800 border-slate-200 dark:border-gray-700'}`}
              >
                <Text className={`capitalize font-medium ${position === pos ? 'text-green-600 dark:text-green-500' : 'text-slate-600 dark:text-slate-300'}`}>
                  {pos === 'cualquiera' ? 'Cualquier posición' : pos}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Date Selector Only */}
        <View className="mt-4">
          <TouchableOpacity 
            className="w-full flex-row items-center p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-900/50"
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={24} color="#22C55E" />
            <Text className="ml-3 font-medium text-slate-700 dark:text-slate-300 text-lg capitalize">{getDateDisplayText()}</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View className="flex-row mt-4 space-x-2 gap-2">
          <TouchableOpacity 
            className="flex-1 items-center py-2 bg-slate-100 dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700"
            onPress={() => handleQuickAction(0)}
          >
            <Text className="text-slate-600 dark:text-slate-300 font-medium">Hoy</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className="flex-1 items-center py-2 bg-slate-100 dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700"
            onPress={() => handleQuickAction(1)}
          >
            <Text className="text-slate-600 dark:text-slate-300 font-medium">Mañana</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className="flex-1 items-center py-2 bg-slate-100 dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700"
            onPress={() => handleQuickAction(0, true)}
          >
            <Text className="text-slate-600 dark:text-slate-300 font-medium">Esta semana</Text>
          </TouchableOpacity>
        </View>

        {/* Date Picker Nativo */}
        {Platform.OS === 'android' && showDatePicker && (
          <DateTimePicker
            value={searchDate}
            mode="date"
            display="default"
            onChange={onDateChange}
            minimumDate={new Date()}
            locale="es-ES"
          />
        )}
        
        {Platform.OS === 'ios' && showDatePicker && (
          <Modal transparent animationType="slide" visible={showDatePicker}>
            <View className="flex-1 justify-end bg-black/60">
              <View className="bg-white dark:bg-gray-900 pb-10 pt-4 px-6 rounded-t-3xl shadow-xl">
                <View className="flex-row justify-between mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text className="text-red-500 font-medium text-lg">Cancelar</Text>
                  </TouchableOpacity>
                  <Text className="text-slate-800 dark:text-slate-100 font-bold text-lg">Fecha de partido</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text className="text-green-500 font-bold text-lg">Confirmar</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={searchDate}
                  mode="date"
                  display="spinner"
                  onChange={onDateChange}
                  minimumDate={new Date()}
                  locale="es-ES"
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Botón Buscar Grande */}
        <TouchableOpacity 
          className="w-full bg-green-500 rounded-2xl p-4 mt-6 items-center shadow-lg" style={{ minHeight: 48 }}
          onPress={() => handleSearch()}
        >
          <Text className="text-white font-bold text-xl">Buscar Partidos</Text>
        </TouchableOpacity>
      </View>

      {/* Alertas de valoraciones pendientes */}
      <View className="px-4 mt-4">
        <PendingReviewsAlert />
      </View>

      {/* Banner promocional debajo */}
      <View className="mx-4 mt-6 bg-green-900/40 rounded-3xl p-5 border border-green-500/30 overflow-hidden mb-10">
        <View className="bg-green-500 self-start px-3 py-1 rounded-full mb-3">
        <Text className="text-white font-bold text-xs uppercase">Conecta y Juega</Text>
        </View>
        <Text className="text-white text-2xl font-bold mb-2">¿No encuentras lo que buscas?</Text>
        <Text className="text-green-100/80 mb-4">
          Organiza tu propio partido, elige el nivel y nosotros te ayudamos a encontrar a los jugadores que faltan para completarlo.
        </Text>
        <TouchableOpacity className="bg-green-600/30 flex-row justify-between items-center p-4 rounded-2xl border border-green-500/50" onPress={() => router.push('/(tabs)/create')}>
          <Text className="text-white font-bold">¡Publicar un partido ahora!</Text>
          <Ionicons name="chevron-forward" size={20} color="white" />
        </TouchableOpacity>
        <Ionicons name="football-outline" size={120} color="rgba(34, 197, 94, 0.1)" style={{ position: 'absolute', right: -20, bottom: -20 }} />
      </View>

      </ScrollView>
    </SafeAreaView>
  );
}
