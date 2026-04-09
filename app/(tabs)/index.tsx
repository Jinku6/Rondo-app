import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuth } from '@/contexts/AuthContext';
import { PendingReviewsAlert } from '@/components/PendingReviewsAlert';

export default function SearchScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  
  const [location, setLocation] = useState('');
  
  // Opciones de Fecha: 'today' o fecha específica
  const [dateType, setDateType] = useState('any'); // any, today, custom
  const [customDate, setCustomDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleSearch = () => {
    let params: any = {};
    if (location.trim()) params.location = location;
    
    if (dateType === 'today') {
      params.date = 'today';
    } else if (dateType === 'custom') {
      const dd = String(customDate.getDate()).padStart(2, '0');
      const mm = String(customDate.getMonth() + 1).padStart(2, '0');
      const yyyy = customDate.getFullYear();
      params.date = `${dd}/${mm}/${yyyy}`;
    }

    router.push({
      pathname: '/search/results',
      params
    });
  };

  const onDateChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setCustomDate(selectedDate);
      setDateType('custom');
    }
  };

  const getDateDisplayText = () => {
    if (dateType === 'any') return 'Cualquier fecha';
    if (dateType === 'today') return 'Hoy';
    const dd = String(customDate.getDate()).padStart(2, '0');
    const mm = String(customDate.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${customDate.getFullYear()}`;
  };

  return (
    <ScrollView className="flex-1 bg-neutral-950 border-t border-neutral-950" 
      contentContainerStyle={{ flexGrow: 1, backgroundColor: '#0A0A0A' }}>
      
      {/* Cabecera BlaBlaCar style */}
      <View className="px-6 pt-10 pb-8">
        <Text className="text-white text-3xl font-bold mb-4">
          ¡Hola, {profile?.full_name?.split(' ')[0] || 'Jugador'}!
        </Text>
        <Text className="text-white text-4xl font-black leading-tight">
          Encuentra tu próximo{'\n'}partido de fútbol,{'\n'}a tu manera con Rondo.
        </Text>
      </View>

      {/* Alertas de valoraciones pendientes */}
      <View className="px-4">
        <PendingReviewsAlert />
      </View>

      {/* Formulario Buscador Azul Flotante */}
      <View className="mx-4 bg-gray-900 rounded-2xl p-5 border border-green-500/30">
        
        {/* Campo Ubicación */}
        <View className="flex-row items-center pb-4 border-b border-gray-800">
          <Ionicons name="location-outline" size={24} color="#94a3b8" />
          <TextInput
            className="flex-1 ml-4 text-white text-lg font-medium"
            placeholder="¿Dónde quieres jugar?"
            placeholderTextColor="#64748b"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Cesta de Fechas */}
        <View className="flex-row mt-4">
          <TouchableOpacity 
            className={`flex-1 flex-row items-center p-3 rounded-xl border ${dateType === 'today' ? 'border-green-500 bg-green-500/10' : 'border-gray-800 bg-gray-900/50'}`}
            onPress={() => setDateType('today')}
          >
            <Ionicons name="calendar-clear-outline" size={20} color={dateType === 'today' ? '#22C55E' : '#94a3b8'} />
            <Text className={`ml-3 font-medium ${dateType === 'today' ? 'text-green-500' : 'text-slate-300'}`}>Hoy</Text>
          </TouchableOpacity>

          <View className="w-3" />

          <TouchableOpacity 
            className={`flex-1 flex-row items-center p-3 rounded-xl border ${dateType === 'custom' || dateType === 'any' ? 'border-green-500 bg-green-500/10' : 'border-gray-800 bg-gray-900/50'}`}
            onPress={() => {
              if (Platform.OS !== 'web') {
                setShowDatePicker(true);
              } else {
                setDateType(dateType === 'any' ? 'today' : 'any');
              }
            }}
          >
            <Ionicons name="calendar-outline" size={20} color={dateType === 'custom' || dateType === 'any' ? '#22C55E' : '#94a3b8'} />
            <Text className={`ml-3 font-medium ${dateType === 'custom' || dateType === 'any' ? 'text-green-500' : 'text-slate-300'}`} numberOfLines={1}>
              {getDateDisplayText()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date Picker Nativo */}
        {Platform.OS !== 'web' && showDatePicker && (
          <DateTimePicker
            value={customDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}

        <View className="flex-row mt-3 items-center justify-center pt-2">
           <TouchableOpacity onPress={() => setDateType('any')}>
             <Text className="text-slate-400 text-sm underline">O buscar en cualquier fecha</Text>
           </TouchableOpacity>
        </View>

        {/* Botón Buscar Grande */}
        <TouchableOpacity 
          className="w-full bg-green-500 rounded-2xl p-4 mt-6 items-center shadow-lg" style={{ minHeight: 48 }}
          onPress={handleSearch}
        >
          <Text className="text-white font-bold text-xl">Buscar Partidos</Text>
        </TouchableOpacity>
      </View>

      {/* Banner promocional debajo */}
      <View className="mx-4 mt-6 bg-emerald-900/40 rounded-3xl p-5 border border-emerald-500/30 overflow-hidden mb-10">
        <View className="bg-emerald-500 self-start px-3 py-1 rounded-full mb-3">
          <Text className="text-white font-bold text-xs uppercase">Promoción Rondo</Text>
        </View>
        <Text className="text-white text-2xl font-bold mb-2">Organiza partidos y juega gratis</Text>
        <Text className="text-emerald-100/80 mb-4">
          Si organizas el partido utilizando nuestro sistema de gestión, tus plazas te salen totalmente gratuitas. ¡Anímate!
        </Text>
        <TouchableOpacity className="bg-emerald-600/30 flex-row justify-between items-center p-4 rounded-2xl border border-emerald-500/50" onPress={() => router.push('/(tabs)/create')}>
          <Text className="text-white font-bold">¡Publicar un partido ahora!</Text>
          <Ionicons name="chevron-forward" size={20} color="white" />
        </TouchableOpacity>
        <Ionicons name="football-outline" size={120} color="rgba(16, 185, 129, 0.1)" className="absolute -right-5 -bottom-5" style={{ position: 'absolute', right: -20, bottom: -20 }} />
      </View>

    </ScrollView>
  );
}
