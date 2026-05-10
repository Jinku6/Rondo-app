import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { PendingReviewNotification, useActivity } from '@/contexts/ActivityContext';
import { Ionicons } from '@expo/vector-icons';

export function PendingReviewsAlert() {
  const router = useRouter();
  const { pendingReviews } = useActivity();

  if (pendingReviews.length === 0) return null;

  const handlePress = (notification: PendingReviewNotification) => {
    if (notification.type === 'pending_organizer_review') {
      router.push(`/match/review-organizer/${notification.match_id}`);
    } else {
      router.push(`/match/review-player/${notification.match_id}`);
    }
  };

  return (
    <View className="mb-4">
      {pendingReviews.map(notif => (
        <TouchableOpacity
          key={notif.id}
          onPress={() => handlePress(notif)}
          className="bg-amber-100 dark:bg-amber-900/40 p-4 rounded-xl flex-row items-center border border-amber-300 dark:border-amber-700 mb-2 shadow-sm"
        >
          <View className="bg-amber-200 dark:bg-amber-800 w-10 h-10 rounded-full justify-center items-center mr-3">
            <Ionicons name="alert-circle" size={24} color="#F59E0B" />
          </View>
          <View className="flex-1">
            <Text className="text-amber-900 dark:text-amber-100 font-bold text-base">
              {notif.type === 'pending_organizer_review' ? 'Asistencia pendiente' : 'Valoración pendiente'}
            </Text>
            <Text className="text-amber-700 dark:text-amber-300 text-sm">
              Partido: {notif.match?.title || 'Anterior'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
        </TouchableOpacity>
      ))}
    </View>
  );
}
