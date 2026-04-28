import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState, useEffect } from 'react';
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';

const c = Colors;

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
  const insets = useSafeAreaInsets();

  const [chatThreads, setChatThreads] = useState<ChatThread[]>([]);
  const [notifications, setNotifications] = useState<ReviewNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (!user) return;
    if (!isRefresh) setLoading(true);
    else setRefreshing(true);

    const { data: threads, error: threadsError } = await supabase.rpc('get_user_chat_threads');
    if (threadsError) {
      if (__DEV__) console.error('Error fetching chat threads:', threadsError.message);
    } else if (threads) {
      setChatThreads(threads as ChatThread[]);
    }

    const { data: notifs, error: notifsError } = await supabase
      .from('notifications')
      .select('*, match:matches(title)')
      .eq('user_id', user.id)
      .eq('read', false)
      .in('type', ['pending_organizer_review', 'pending_player_review'])
      .order('created_at', { ascending: false });

    if (notifsError) {
      if (__DEV__) console.error('Error fetching notifications:', notifsError.message);
    } else if (notifs) {
      setNotifications(notifs as ReviewNotification[]);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`messages-screen-realtime-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]),
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
      style={{
        backgroundColor: 'rgba(245,158,11,0.08)',
        padding: 14,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.25)',
        marginBottom: 10,
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(245,158,11,0.15)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
        <Ionicons name="star-outline" size={22} color="#F59E0B" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>
          {item.type === 'pending_organizer_review' ? 'Asistencia pendiente' : 'Valoración pendiente'}
        </Text>
        <Text style={{ color: c.textDim, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {item.match?.title || 'Partido'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
    </TouchableOpacity>
  );

  const renderChatThread = ({ item }: { item: ChatThread }) => {
    const isUnread = !item.is_read && item.sender_id !== user?.id;
    return (
      <TouchableOpacity
        onPress={() => handleChatPress(item)}
        style={{
          backgroundColor: c.bgElev,
          padding: 14,
          borderRadius: 18,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: isUnread ? c.brand + '33' : c.border,
          marginBottom: 10,
        }}
      >
        {/* Avatar */}
        {item.other_user_avatar ? (
          <Image
            source={{ uri: `${item.other_user_avatar}?t=${Date.now()}` }}
            style={{ width: 46, height: 46, borderRadius: 14, marginRight: 12, borderWidth: 1, borderColor: c.border }}
          />
        ) : (
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.brandSoft, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
            <Text style={{ color: c.brand, fontWeight: '800', fontSize: 17 }}>
              {item.other_user_name?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}

        {/* Content */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <Text style={{ fontSize: 14, fontWeight: isUnread ? '800' : '600', color: c.text }} numberOfLines={1}>
              {item.other_user_name}
            </Text>
            <Text style={{ fontSize: 11, color: isUnread ? c.brand : c.textMuted, fontWeight: isUnread ? '700' : '400' }}>
              {formatTimeAgo(item.last_message_at)}
            </Text>
          </View>

          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3, alignSelf: 'flex-start' }}
            onPress={(e) => { e.stopPropagation(); router.push(`/match/${item.match_id}` as any); }}
          >
            <Ionicons name="football-outline" size={11} color={c.brand} />
            <Text style={{ color: c.brand, fontSize: 11, marginLeft: 4, fontWeight: '600' }} numberOfLines={1}>
              {item.match_title}
            </Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 13, color: isUnread ? c.textDim : c.textMuted }} numberOfLines={1}>
            {item.sender_id === user?.id ? 'Tú: ' : ''}{item.last_message}
          </Text>
        </View>

        {isUnread && (
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.brand, marginLeft: 8 }} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={c.brand} />
      </View>
    );
  }

  const hasNotifications = notifications.length > 0;
  const hasChats = chatThreads.length > 0;
  const isEmpty = !hasNotifications && !hasChats;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      <FlatList
        data={[]}
        renderItem={null}
        keyExtractor={() => 'dummy'}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: FLOATING_TAB_BAR_HEIGHT + 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchData(true)} colors={[c.brand]} tintColor={c.brand} />
        }
        ListHeaderComponent={
          <>
            {/* Header */}
            <View style={{ paddingTop: insets.top + 16, marginBottom: 24 }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: c.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
                BANDEJA
              </Text>
              <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 28, fontWeight: '900', color: c.text, letterSpacing: -0.5 }}>
                Mensajes
              </Text>
            </View>

            {/* Notifications */}
            {hasNotifications && (
              <View style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Ionicons name="notifications-outline" size={16} color="#F59E0B" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    Pendientes
                  </Text>
                </View>
                {notifications.map((notif) => (
                  <View key={notif.id}>
                    {renderNotification({ item: notif })}
                  </View>
                ))}
              </View>
            )}

            {/* Chat threads */}
            {hasChats && (
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Ionicons name="chatbubbles-outline" size={16} color={c.brand} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    Chats
                  </Text>
                </View>
                {chatThreads.map((thread) => (
                  <View key={`${thread.match_id}_${thread.player_id}`}>
                    {renderChatThread({ item: thread })}
                  </View>
                ))}
              </View>
            )}

            {/* Empty state */}
            {isEmpty && (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 24 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: c.bgElev, borderWidth: 1, borderColor: c.border, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                  <Ionicons name="chatbubbles-outline" size={36} color={c.textMuted} />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 8 }}>Sin mensajes</Text>
                <Text style={{ color: c.textDim, textAlign: 'center', fontSize: 14, lineHeight: 20 }}>
                  Cuando te apuntes a un partido o alguien se apunte al tuyo, aquí aparecerán tus conversaciones.
                </Text>
              </View>
            )}
          </>
        }
      />
    </View>
  );
}
