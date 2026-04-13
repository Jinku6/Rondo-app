import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { isValidUUID, firstParam, isSafeUrl } from '@/lib/utils';

interface ReviewSetup {
  reviewee_id: string;
  name: string;
  avatar_url: string | null;
  position: string | null;
  level: number;
  matches_played: number;
}

export default function ReviewCarouselScreen() {
  const params = useLocalSearchParams();
  const id = firstParam(params.id as string | string[]);
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [match, setMatch] = useState<any>(null);
  
  // The list of users to review
  const [reviewees, setReviewees] = useState<ReviewSetup[]>([]);
  // Current index in the carousel
  const [currentIndex, setCurrentIndex] = useState(0);

  // Form states for the current reviewee
  const [attended, setAttended] = useState<boolean | null>(null);
  const [levelRating, setLevelRating] = useState(0);
  const [attitude, setAttitude] = useState<'positive' | 'neutral' | 'negative' | null>(null);

  // Stored reviews waiting to be committed
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);

  useEffect(() => {
    fetchMatchAndParticipants();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchMatchAndParticipants = async () => {
    if (!user) return;
    if (!isValidUUID(id)) {
      Alert.alert('Error', 'Partido no válido');
      router.back();
      return;
    }

    // Fetch match
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*, organizer:users(*)')
      .eq('id', id)
      .single();

    if (matchError || !matchData) {
      Alert.alert('Error', 'No se pudo cargar el partido');
      router.back();
      return;
    }

    // Guard: solo el organizador o un participante aprobado puede acceder a la pantalla de valoraciones
    const isOrganizer = matchData.organizer_id === user.id;
    const { data: myParticipation } = await supabase
      .from('match_participants')
      .select('status')
      .eq('match_id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    const isParticipant = myParticipation?.status === 'joined' || myParticipation?.status === 'approved';

    if (!isOrganizer && !isParticipant) {
      Alert.alert('Acceso denegado', 'No participaste en este partido.');
      router.back();
      return;
    }

    setMatch(matchData);

    // Fetch participants
    const { data: partData, error: partError } = await supabase
      .from('match_participants')
      .select('*, user:users(*)')
      .eq('match_id', id)
      .in('status', ['joined', 'approved']);

    if (partError) {
      Alert.alert('Error', 'No se pudieron cargar los participantes');
      router.back();
      return;
    }

    // Build the list to review (everyone except me)
    const toReview: ReviewSetup[] = [];

    // Add organizer if it's not me
    if (matchData.organizer_id !== user.id && matchData.organizer) {
      toReview.push({
        reviewee_id: matchData.organizer_id,
        name: matchData.organizer.full_name,
        avatar_url: matchData.organizer.avatar_url,
        position: matchData.organizer.preferred_position,
        level: matchData.organizer.average_level,
        matches_played: matchData.organizer.matches_played || 0,
      });
    }

    // Add participants if it's not me
    partData?.forEach((p: any) => {
      if (p.user_id !== user.id && p.user_id !== matchData.organizer_id && p.user) {
        toReview.push({
          reviewee_id: p.user_id,
          name: p.user.full_name,
          avatar_url: p.user.avatar_url,
          position: p.user.preferred_position,
          level: p.user.average_level,
          matches_played: p.user.matches_played || 0,
        });
      }
    });

    if (toReview.length === 0) {
      // Nothing to review, clear notification
      await clearNotification();
      Alert.alert('Aviso', 'No hay otros jugadores para valorar en este partido.', [
        { text: 'Aceptar', onPress: () => router.replace('/(tabs)') },
      ]);
      return;
    }

    setReviewees(toReview);
    setLoading(false);
  };

  const clearNotification = async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('match_id', id)
      .in('type', ['pending_player_review', 'pending_organizer_review']);
  };

  const resetForm = () => {
    setAttended(null);
    setLevelRating(0);
    setAttitude(null);
  };

  const buildReview = () => {
    const currentReviewee = reviewees[currentIndex];
    
    if (attended === false) {
      return {
        match_id: id,
        reviewer_id: user?.id,
        reviewee_id: currentReviewee.reviewee_id,
        level_rating: null,
        attitude: null,
        attended: false
      };
    }

    return {
      match_id: id,
      reviewer_id: user?.id,
      reviewee_id: currentReviewee.reviewee_id,
      level_rating: levelRating,
      attitude: attitude,
      attended: true
    };
  };

  const handleNext = async () => {
    if (attended === null) {
      Alert.alert('Atención', 'Por favor, indica si este jugador asistió al partido.');
      return;
    }

    if (attended === true && (levelRating === 0 || !attitude)) {
      Alert.alert('Atención', 'Por favor, completa el nivel y la actitud antes de continuar.');
      return;
    }

    const newReview = buildReview();
    const allReviews = [...pendingReviews, newReview];
    setPendingReviews(allReviews);

    if (currentIndex < reviewees.length - 1) {
      // Move to next
      resetForm();
      setCurrentIndex(currentIndex + 1);
    } else {
      // Submit all
      setSaving(true);
      try {
        const { error } = await supabase.from('match_reviews').insert(allReviews);
        if (error) throw error;
        
        await clearNotification();
        Alert.alert('¡Gracias!', 'Has enviado todas tus valoraciones.', [
          { text: 'Aceptar', onPress: () => router.replace('/(tabs)') },
        ]);
      } catch (error) {
        Alert.alert('Error al guardar', error instanceof Error ? error.message : String(error));
      } finally {
        setSaving(false);
      }
    }
  };

  const renderStars = () => {
    return (
      <View className="flex-row justify-center space-x-2 my-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setLevelRating(star)} className="px-1">
            <Ionicons
              name={levelRating >= star ? 'star' : 'star-outline'}
              size={40}
              color={levelRating >= star ? '#eab308' : '#cbd5e1'}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-neutral-950 justify-center items-center">
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  const current = reviewees[currentIndex];
  const isLast = currentIndex === reviewees.length - 1;

  return (
    <View className="flex-1 bg-neutral-950">
      <Stack.Screen options={{ title: 'Valorar a tus compañeros' }} />

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text className="text-xl font-bold text-slate-400 mb-6">
          {match?.title}
        </Text>

        <View className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          
          {/* Header del Jugador */}
          <View className="flex-row items-center mb-6 border-b border-gray-800 pb-4">
            {isSafeUrl(current.avatar_url) ? (
              <Image source={{ uri: current.avatar_url }} className="w-14 h-14 rounded-full mr-4 bg-gray-800" />
            ) : (
              <View className="w-14 h-14 rounded-full bg-slate-800 justify-center items-center mr-4">
                <Text className="text-xl font-bold text-slate-400">
                  {current.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View className="flex-1">
              <Text className="text-xl font-bold text-white">{current.name}</Text>
              
              {current.matches_played < 3 ? (
                <View className="bg-green-500/20 px-2 py-1 rounded-md self-start mt-1">
                  <Text className="text-green-500 font-semibold text-xs">🌱 Jugador Nuevo</Text>
                </View>
              ) : (
                <Text className="text-slate-400 capitalize">
                  {current.position || 'Jugador'}
                </Text>
              )}
            </View>
          </View>

          {/* 1. Asistencia (siempre visible) */}
          <View className="mb-6">
            <Text className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">¿Asistió al partido?</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => setAttended(true)}
                className={`flex-1 px-4 py-3 rounded-xl border ${attended === true ? 'bg-green-500/20 border-green-500' : 'bg-transparent border-gray-700'} items-center`}
              >
                <Text className={`font-semibold ${attended === true ? 'text-green-500' : 'text-slate-300'}`}>
                  ✅ Sí, asistió
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={() => {
                  setAttended(false);
                  setLevelRating(0);
                  setAttitude(null);
                }}
                className={`flex-1 px-4 py-3 rounded-xl border ${attended === false ? 'bg-red-500/20 border-red-500' : 'bg-transparent border-gray-700'} items-center`}
              >
                <Text className={`font-semibold ${attended === false ? 'text-red-500' : 'text-slate-300'}`}>
                  ❌ No apareció
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 2. Nivel y actitud (solo si asistió) */}
          {attended === true && (
            <>
              {/* Valoración Nivel */}
              <View className="mb-6">
                <Text className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Valoración General</Text>
                {renderStars()}
              </View>

              {/* Valoración Actitud */}
              <View className="mb-6">
                <Text className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Actitud</Text>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    { val: 'positive', label: '🤩 Positiva' },
                    { val: 'neutral', label: '😐 Neutral' },
                    { val: 'negative', label: '😠 Negativa' }
                  ].map(opt => {
                    const isActive = attitude === opt.val;
                    return (
                      <TouchableOpacity
                        key={opt.val}
                        onPress={() => setAttitude(opt.val as any)}
                        className={`px-4 py-3 rounded-full border ${isActive ? 'bg-green-500/20 border-green-500' : 'bg-transparent border-gray-700'}`}
                      >
                        <Text className={`font-semibold ${isActive ? 'text-green-500' : 'text-slate-300'}`}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {/* Mensaje si no asistió */}
          {attended === false && (
            <View className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-2">
              <Text className="text-red-400 text-center text-sm">
                Se registrará la inasistencia de este jugador. Pulsa siguiente para continuar.
              </Text>
            </View>
          )}

        </View>
      </ScrollView>

      <View className="p-4 bg-gray-900 border-t border-gray-800">
        <TouchableOpacity 
          className="bg-green-500 rounded-xl p-4 items-center" 
          onPress={handleNext}
          disabled={saving}
          style={{ minHeight: 48 }}
        >
          {saving ? <ActivityIndicator color="#fff" /> : (
            <Text className="text-white font-bold text-lg">
              {isLast ? `Enviar valoraciones (${currentIndex + 1}/${reviewees.length})` : `Siguiente (${currentIndex + 1}/${reviewees.length})`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
