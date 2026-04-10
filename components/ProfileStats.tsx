import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UserProfile } from '@/types/database';

interface ProfileStatsProps {
  profile: UserProfile;
}

export function ProfileStats({ profile }: ProfileStatsProps) {
  const getAttitudeEmojis = (rating: number) => {
    if (rating === 0) return 'Sin valorar';
    if (rating >= 4) return '🤩';
    if (rating >= 2.5) return '😐';
    return '😠';
  };

  const getAttendanceLabel = (score: number) => {
    if (score >= 90) return { label: 'Nunca falta', icon: '✅', color: 'text-green-500 dark:text-green-400' };
    if (score >= 75) return { label: 'Casi nunca falta', icon: '🌟', color: 'text-amber-500 dark:text-amber-400' };
    if (score >= 50) return { label: 'Falta con frecuencia', icon: '⚠️', color: 'text-orange-500 dark:text-orange-400' };
    return { label: 'Falta casi siempre', icon: '🚫', color: 'text-red-600 dark:text-red-500' };
  };

  return (
    <View className="w-full space-y-4">
      {profile.matches_played < 3 ? (
        <View className="w-full mt-2 flex-col items-center p-6 bg-green-500/10 border border-green-500/20 rounded-2xl">
          <Text className="text-4xl mb-2">🌱</Text>
          <Text className="text-xl font-bold text-green-700 dark:text-green-400 mb-1">Jugador Nuevo</Text>
          <Text className="text-slate-600 dark:text-slate-400 text-center text-sm">
            Las estadísticas permanecerán ocultas hasta completar al menos 3 partidos valorados. ({profile.matches_played}/3)
          </Text>
        </View>
      ) : (
        <>
          <View className="flex-row gap-4 mb-2 mt-2">
            {/* Partidos Jugados */}
            <View className="flex-1 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 items-center justify-center shadow-sm">
              <Ionicons name="football" size={24} color="#94a3b8" className="mb-2" />
              <Text className="text-3xl font-black text-slate-800 dark:text-white mt-1">{profile.matches_played}</Text>
              <Text className="text-slate-500 dark:text-slate-400 text-xs mt-1 uppercase tracking-wider font-semibold text-center">Partidos</Text>
            </View>

            {/* Fiabilidad - Cluster rediseñado textualmente */}
            {(() => {
              const { label, icon, color } = getAttendanceLabel(profile.reliability_score);
              return (
                <View className="flex-1 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 items-center justify-center shadow-sm">
                  <Text className="text-2xl mb-1">{icon}</Text>
                  <Text className={`font-bold text-center mt-1 text-sm ${color}`}>{label}</Text>
                  <Text className="text-slate-500 dark:text-slate-400 text-xs mt-1 uppercase tracking-wider font-semibold text-center">Asistencia</Text>
                </View>
              );
            })()}
          </View>

          {/* Actitud y Nivel */}
          <View className="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm mt-2">
            <View className="flex-row justify-between items-center mb-6">
              <View>
                <Text className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase mb-1">Nivel Técnico</Text>
                <Text className="text-3xl font-black text-amber-500 dark:text-amber-400">
                  {profile.average_level > 0 ? profile.average_level.toFixed(1) : 'N/A'}
                </Text>
              </View>
              <Ionicons name="speedometer-outline" size={36} color="#fbbf24" style={{ opacity: 0.8 }} />
            </View>
            
            <View className="h-px bg-slate-100 dark:bg-gray-800 w-full mb-6" />

            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase mb-1">Actitud en pista</Text>
                <Text className="text-2xl">{getAttitudeEmojis(profile.average_attitude)}</Text>
              </View>
              <Ionicons name="happy-outline" size={36} color="#fbbf24" style={{ opacity: 0.8 }} />
            </View>
          </View>
        </>
      )}
    </View>
  );
}
