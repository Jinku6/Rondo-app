import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface MatchNotification {
  id: string;
  user_id: string;
  match_id: string;
  type: 'pending_organizer_review' | 'pending_player_review';
  read: boolean;
  created_at: string;
  match?: { title: string } | null;
}

export function PendingReviewsAlert() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<MatchNotification[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
  }, [user]);

  const fetchNotifications = async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, match:matches(title)')
      .eq('user_id', user!.id)
      .eq('read', false)
      .in('type', ['pending_organizer_review', 'pending_player_review']);

    if (error) {
      console.error('Error fetching notifications:', error.message);
      return;
    }

    if (data) {
      setNotifications(data as MatchNotification[]);
    }
  };

  if (notifications.length === 0) return null;

  const handlePress = (notification: any) => {
    if (notification.type === 'pending_organizer_review') {
      router.push(`/match/review-organizer/${notification.match_id}`);
    } else {
      router.push(`/match/review-player/${notification.match_id}`);
    }
  };

  return (
    <View className="mb-4">
      {notifications.map(notif => (
        <TouchableOpacity
          key={notif.id}
          onPress={() => handlePress(notif)}
          className="bg-amber-100 dark:bg-amber-900/40 p-4 rounded-xl flex-row items-center border border-amber-300 dark:border-amber-700 mb-2 shadow-sm"
        >
          <View className="bg-amber-200 dark:bg-amber-800 w-10 h-10 rounded-full justify-center items-center mr-3">
            <Ionicons name="alert-circle" size={24} color="#D97706" />
          </View>
          <View className="flex-1">
            <Text className="text-amber-900 dark:text-amber-100 font-bold text-base">
              {notif.type === 'pending_organizer_review' ? 'Asistencia pendiente' : 'Valoración pendiente'}
            </Text>
            <Text className="text-amber-700 dark:text-amber-300 text-sm">
              Partido: {notif.match?.title || 'Anterior'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#D97706" />
        </TouchableOpacity>
      ))}
    </View>
  );
}
