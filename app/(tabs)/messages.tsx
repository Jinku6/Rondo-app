import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState, useEffect } from 'react';
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ChatThread {
  match_id: string;
  player_id: string;
  organizer_id: string;
  match_title: string;
  last_message: string;
  last_message_at: string;
  sender_id: string;
  is_read: boolean;
  other_user_name: string;
  other_user_avatar: string | null;
}

interface ReviewNotification {
  id: string;
  user_id: string;
  match_id: string;
  type: 'pending_organizer_review' | 'pending_player_review';
  read: boolean;
  created_at: string;
  match?: { title: string } | null;
}

export default function MessagesScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [notifications, setNotifications] = useState<ReviewNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (!user) return;
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);

    // Fetch chat threads via RPC
    const { data: threads, error: threadsError } = await supabase.rpc('get_user_chat_threads');
    if (threadsError) {
      console.error('Error fetching chat threads:', threadsError.message);
    } else if (threads) {
      setChatThreads(threads as ChatThread[]);
    }

    // Fetch pending review notifications
    const { data: notifs, error: notifsError } = await supabase
      .from('notifications')
      .select('*, match:matches(title)')
      .eq('user_id', user.id)
      .eq('read', false)
      .in('type', ['pending_organizer_review', 'pending_player_review'])
      .order('created_at', { ascending: false });

    if (notifsError) {
      console.error('Error fetching notifications:', notifsError.message);
    } else if (notifs) {
      setNotifications(notifs as ReviewNotification[]);
    }

    setLoading(false);
    setRefreshing(false);
  };

  // Real-time updates for the list
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-screen-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchData(true))
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Refresh every time the tab is focused
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [user])
  );

  const handleNotificationPress = (notif: ReviewNotification) => {
    if (notif.type === 'pending_organizer_review') {
      router.push(`/match/review-organizer/${notif.match_id}` as any);
    } else {
      router.push(`/match/review-player/${notif.match_id}` as any);
    }
  };

  const handleChatPress = (thread: ChatThread) => {
    router.push(`/chat/${thread.match_id}/${thread.player_id}` as any);
  };

  const formatTimeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const renderNotification = ({ item }: { item: ReviewNotification }) => (
    <TouchableOpacity
      onPress={() => handleNotificationPress(item)}
      className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl flex-row items-center border border-amber-200 dark:border-amber-800 mb-3"
    >
      <View className="bg-amber-100 dark:bg-amber-800 w-12 h-12 rounded-full justify-center items-center mr-3">
        <Ionicons name="star-outline" size={24} color="#F59E0B" />
      </View>
      <View className="flex-1">
        <Text className="text-slate-900 dark:text-white font-bold text-base">
          {item.type === 'pending_organizer_review' ? 'Asistencia pendiente' : 'Valoración pendiente'}
        </Text>
        <Text className="text-slate-500 dark:text-slate-400 text-sm" numberOfLines={1}>
          {item.match?.title || 'Partido'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  const renderChatThread = ({ item }: { item: ChatThread }) => {
    const isUnread = !item.is_read && item.sender_id !== user?.id;
    return (
      <TouchableOpacity
        onPress={() => handleChatPress(item)}
        className="bg-white dark:bg-gray-900 p-4 rounded-xl flex-row items-center border border-gray-200 dark:border-gray-800 mb-3 shadow-sm"
      >
        {/* Avatar */}
        {item.other_user_avatar ? (
          <Image
            source={{ uri: `${item.other_user_avatar}?t=${Date.now()}` }}
            className="w-12 h-12 rounded-full mr-3 border border-gray-200 dark:border-gray-700"
          />
        ) : (
          <View className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 justify-center items-center mr-3">
            <Text className="text-green-600 dark:text-green-400 font-bold text-lg">
              {item.other_user_name?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}

        {/* Content */}
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-0.5">
            <Text className={`text-base ${isUnread ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-800 dark:text-slate-200'}`} numberOfLines={1}>
              {item.other_user_name}
            </Text>
            <Text className={`text-xs ${isUnread ? 'text-green-600 font-bold' : 'text-slate-400'}`}>
              {formatTimeAgo(item.last_message_at)}
            </Text>
          </View>

          {/* Match badge - clickable */}
          <TouchableOpacity
            className="flex-row items-center mb-1 self-start"
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/match/${item.match_id}` as any);
            }}
          >
            <Ionicons name="football-outline" size={12} color="#22C55E" />
            <Text className="text-green-600 dark:text-green-400 text-xs ml-1 font-medium" numberOfLines={1}>
              {item.match_title}
            </Text>
          </TouchableOpacity>

          {/* Last message */}
          <Text
            className={`text-sm ${isUnread ? 'font-semibold text-slate-700 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}
            numberOfLines={1}
          >
            {item.sender_id === user?.id ? 'Tú: ' : ''}{item.last_message}
          </Text>
        </View>

        {/* Unread dot */}
        {isUnread && (
          <View className="w-3 h-3 rounded-full bg-green-500 ml-2" />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-neutral-950 justify-center items-center">
        <Stack.Screen options={{ title: 'Mis mensajes' }} />
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  const hasNotifications = notifications.length > 0;
  const hasChats = chatThreads.length > 0;
  const isEmpty = !hasNotifications && !hasChats;

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-neutral-950" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <FlatList
        data={[]} // We use ListHeaderComponent for everything
        renderItem={null}
        keyExtractor={() => 'dummy'}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} colors={['#22C55E']} tintColor="#22C55E" />
        }
        ListHeaderComponent={
          <>
            <Text className="text-3xl font-bold text-slate-900 dark:text-white mb-6">Mis Mensajes</Text>

            {/* Notifications section */}
            {hasNotifications && (
              <View className="mb-6">
                <Text className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                  <Ionicons name="notifications-outline" size={18} color="#F59E0B" />  Pendientes
                </Text>
                {notifications.map((notif) => (
                  <View key={notif.id}>
                    {renderNotification({ item: notif })}
                  </View>
                ))}
              </View>
            )}

            {/* Chat threads section */}
            {hasChats && (
              <View>
                <Text className="text-lg font-bold text-slate-900 dark:text-white mb-3">
                  <Ionicons name="chatbubbles-outline" size={18} color="#22C55E" />  Chats
                </Text>
                {chatThreads.map((thread) => (
                  <View key={`${thread.match_id}_${thread.player_id}`}>
                    {renderChatThread({ item: thread })}
                  </View>
                ))}
              </View>
            )}

            {/* Empty state */}
            {isEmpty && (
              <View className="items-center justify-center mt-20">
                <View className="bg-slate-200 dark:bg-gray-800 rounded-full w-20 h-20 justify-center items-center mb-4">
                  <Ionicons name="chatbubbles-outline" size={40} color="#9ca3af" />
                </View>
                <Text className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  Sin mensajes
                </Text>
                <Text className="text-slate-500 dark:text-slate-400 text-center px-10">
                  Cuando te apuntes a un partido o alguien se apunte al tuyo, aquí aparecerán tus conversaciones y notificaciones.
                </Text>
              </View>
            )}
          </>
        }
      />
    </SafeAreaView>
  );
}
