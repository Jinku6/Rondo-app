import { ConversationListItem, ConversationListItemData } from '@/components/messages/ConversationListItem';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { isSafeUrl } from '@/lib/utils';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { PendingReviewsAlert } from '@/components/PendingReviewsAlert';
import { useTheme } from '@/hooks/use-theme';

type MessagesTab = 'active' | 'archived';

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
  archived: boolean;
}

const avatarClasses = ['bg-purple-500', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500'] as const;

function formatTimeLabel(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.floor((startOfToday - startOfDate) / 86_400_000);

  if (dayDiff <= 0) {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  if (dayDiff === 1) return 'Ayer';

  return date.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function toConversation(thread: ChatThread, currentUserId?: string): ConversationListItemData {
  const name = thread.other_user_name || 'Jugador';
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const colorIndex = Math.abs(initial.charCodeAt(0)) % avatarClasses.length;

  return {
    id: `${thread.match_id}_${thread.player_id}`,
    matchId: thread.match_id,
    playerId: thread.player_id,
    name,
    initials: initial,
    lastMessage: `${thread.sender_id === currentUserId ? 'Tú: ' : ''}${thread.last_message}`,
    timeLabel: formatTimeLabel(thread.last_message_at),
    avatarClassName: avatarClasses[colorIndex],
    avatarUrl: isSafeUrl(thread.other_user_avatar) ? thread.other_user_avatar : null,
    archived: thread.archived,
    unread: !thread.is_read && thread.sender_id !== currentUserId,
  };
}

export default function MessagesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [selectedTab, setSelectedTab] = useState<MessagesTab>('active');
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const conversations = useMemo(
    () => threads
      .map((thread) => toConversation(thread, user?.id))
      .filter((conversation) => conversation.archived === (selectedTab === 'archived')),
    [selectedTab, threads, user?.id],
  );

  const fetchThreads = useCallback(async (isRefresh = false) => {
    if (!user) {
      setThreads([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage(null);

    const { data, error } = await supabase.rpc('get_user_chat_threads');

    if (error) {
      if (__DEV__) console.error('Error fetching chat threads:', error.message);
      setErrorMessage('No se pudieron cargar tus mensajes.');
    } else {
      setThreads((data ?? []) as ChatThread[]);
    }

    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      fetchThreads();
    }, [fetchThreads]),
  );

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`messages-match-status-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, () => {
        void fetchThreads(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchThreads, user]);

  const handleConversationPress = (conversation: ConversationListItemData) => {
    router.push({
      pathname: '/chat/[match_id]/[player_id]',
      params: {
        match_id: conversation.matchId,
        player_id: conversation.playerId,
      },
    });
  };

  const renderListEmpty = () => {
    if (loading) {
      return (
        <View className="items-center justify-center pt-16">
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      );
    }

    if (errorMessage) {
      return (
        <View className="items-center px-6 pt-16">
          <Text className="font-body text-base font-bold text-ink">No se han podido cargar</Text>
          <Text className="mt-1.5 text-center font-body text-[13px] text-ink-dim">{errorMessage}</Text>
          <Pressable
            onPress={() => fetchThreads(true)}
            accessibilityRole="button"
            accessibilityLabel="Reintentar cargar mensajes"
            className="mt-5 rounded-xl bg-brand px-5 py-3"
            style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}
          >
            <Text className="font-display text-xs uppercase tracking-wider text-white">Reintentar</Text>
          </Pressable>
        </View>
      );
    }

    if (selectedTab === 'archived') {
      return (
        <View className="items-center px-6 pt-16">
          <Text className="mb-3 text-[40px]">📦</Text>
          <Text className="font-body text-base font-bold text-ink">No hay chats archivados</Text>
          <Text className="mt-1.5 text-center font-body text-[13px] text-ink-dim">
            Los chats archivados aparecerán aquí.
          </Text>
        </View>
      );
    }

    return (
      <View className="items-center px-6 pt-16">
        <Text className="font-body text-base font-bold text-ink">No tienes mensajes activos</Text>
        <Text className="mt-1.5 text-center font-body text-[13px] text-ink-dim">
          Cuando empieces una conversación desde un partido, aparecerá aquí.
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationListItem conversation={item} onPress={handleConversationPress} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchThreads(true)}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 0,
            paddingBottom: insets.bottom + FLOATING_TAB_BAR_HEIGHT + 16,
          }}
          ListHeaderComponent={
            <View style={{ paddingTop: insets.top + 16, marginBottom: 20 }}>
              <Text className="font-mono text-xs text-ink-dim tracking-[0.2em] uppercase mb-1">
                CHAT
              </Text>
              <View className="mb-6">
                <ScreenTitle>
                  Mis Mensajes
                </ScreenTitle>
              </View>

              <PendingReviewsAlert />

              <View className="flex-row bg-surface p-1 rounded-xl mb-2">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSelectedTab('active')}
                  className={`flex-1 items-center justify-center py-3 rounded-lg ${selectedTab === 'active' ? 'bg-brand border border-brand' : 'bg-input/5 border border-border'}`}
                >
                  <Text className={`font-display uppercase text-xs tracking-wider ${selectedTab === 'active' ? 'text-white' : 'text-ink-dim'}`}>Activos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setSelectedTab('archived')}
                  className={`flex-1 items-center justify-center py-3 rounded-lg ${selectedTab === 'archived' ? 'bg-input/15 border border-border-strong' : 'bg-input/5 border border-border'}`}
                >
                  <Text className={`font-display uppercase text-xs tracking-wider ${selectedTab === 'archived' ? 'text-ink' : 'text-ink-dim'}`}>Archivados</Text>
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={renderListEmpty}
          showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
