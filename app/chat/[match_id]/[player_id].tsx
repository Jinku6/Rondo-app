import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { processMessageText } from '@/lib/messageFilter';
import { supabase } from '@/lib/supabase';
import { firstParam, isSafeUrl } from '@/lib/utils';
import { ChatMessage, UserProfile } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const c = Colors;

type MatchDetails = {
  organizer_id: string;
  title: string;
  id: string;
  date_time: string | null;
};

function formatCompactMatchDate(iso?: string | null): string | null {
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).formatToParts(date);
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value.replace('.', '') ?? '';
  const titleCase = (value: string) =>
    value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return `${titleCase(getPart('weekday'))} ${getPart('day')} ${titleCase(getPart('month'))} · ${time}`;
}

function Avatar({ user }: { user: UserProfile }) {
  const initial = user.full_name?.charAt(0).toUpperCase() || '?';

  if (isSafeUrl(user.avatar_url)) {
    return (
      <Image
        source={{ uri: user.avatar_url }}
        style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.bgSurface2 }}
      />
    );
  }

  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: c.brandSoft,
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.28)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontWeight: '700', color: c.brand, fontSize: 15 }}>{initial}</Text>
    </View>
  );
}

function CompactMatchPill({
  match,
  onPress,
}: {
  match: MatchDetails;
  onPress: () => void;
}) {
  const matchDate = formatCompactMatchDate(match.date_time);
  const label = matchDate ? `${match.title} · ${matchDate}` : match.title;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        minHeight: 40,
        maxWidth: 172,
        flexShrink: 1,
        justifyContent: 'center',
        borderRadius: 13,
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.28)',
        backgroundColor: c.brandSoft,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text
        numberOfLines={1}
        style={{ color: c.text, fontSize: 11, fontWeight: '700', lineHeight: 15 }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ChatHeader({
  otherUser,
  matchDetails,
  onUserPress,
  onMatchPress,
}: {
  otherUser: UserProfile | null;
  matchDetails: MatchDetails | null;
  onUserPress: () => void;
  onMatchPress: () => void;
}) {
  if (!otherUser) {
    return <Text style={{ color: c.text, fontSize: 15, fontWeight: '700' }}>Chat</Text>;
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10, minWidth: 0 }}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onUserPress}
        style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}
      >
        <Avatar user={otherUser} />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            minWidth: 0,
            marginLeft: 9,
            color: c.text,
            fontSize: 15,
            lineHeight: 19,
            fontWeight: '700',
          }}
        >
          {otherUser.full_name}
        </Text>
      </TouchableOpacity>

      {matchDetails && (
        <CompactMatchPill match={matchDetails} onPress={onMatchPress} />
      )}
    </View>
  );
}

function MessageBubble({ item, isMe }: { item: ChatMessage; isMe: boolean }) {
  return (
    <View style={{ maxWidth: '82%', alignSelf: isMe ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
      <View
        style={{
          backgroundColor: isMe ? c.brand : c.bgSurface2,
          borderColor: isMe ? c.brand : c.border,
          borderWidth: 1,
          borderRadius: 20,
          borderBottomRightRadius: isMe ? 6 : 20,
          borderBottomLeftRadius: isMe ? 20 : 6,
          paddingHorizontal: 14,
          paddingVertical: 10,
        }}
      >
        <Text style={{ color: c.text, fontSize: 16, lineHeight: 21 }}>
          {item.content}
        </Text>
      </View>
      <Text
        style={{
          color: c.textDim,
          fontSize: 11,
          lineHeight: 14,
          marginTop: 4,
          marginHorizontal: 5,
          textAlign: isMe ? 'right' : 'left',
        }}
      >
        {new Date(item.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

function ChatInputBar({
  value,
  sending,
  bottomInset,
  onChangeText,
  onSend,
  onFocus,
}: {
  value: string;
  sending: boolean;
  bottomInset: number;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onFocus: () => void;
}) {
  const canSend = value.trim().length > 0 && !sending;

  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: Math.max(bottomInset, 12),
        backgroundColor: c.bg,
        borderTopWidth: 1,
        borderTopColor: c.border,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      <TextInput
        style={{
          flex: 1,
          maxHeight: 116,
          minHeight: 44,
          backgroundColor: c.bgSurface,
          borderRadius: 22,
          color: c.text,
          fontSize: 16,
          lineHeight: 21,
          paddingHorizontal: 16,
          paddingTop: Platform.OS === 'ios' ? 12 : 9,
          paddingBottom: Platform.OS === 'ios' ? 12 : 9,
        }}
        placeholder="Escribe un mensaje..."
        placeholderTextColor={c.textDim}
        value={value}
        onChangeText={onChangeText}
        multiline
        maxLength={500}
        onFocus={onFocus}
      />
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Enviar mensaje"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: canSend ? c.brand : 'rgba(34,197,94,0.35)',
        }}
      >
        {sending ? (
          <ActivityIndicator size="small" color={c.text} />
        ) : (
          <Ionicons name="send" size={18} color={c.text} style={{ marginLeft: 2 }} />
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function ChatScreen() {
  const { match_id, player_id } = useLocalSearchParams();
  const matchId = useMemo(() => firstParam(match_id as string | string[]), [match_id]);
  const playerId = useMemo(() => firstParam(player_id as string | string[]), [player_id]);
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [matchDetails, setMatchDetails] = useState<MatchDetails | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToEnd = useCallback((animated = true) => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated }), 50);
  }, []);

  const markMessagesAsRead = useCallback(async () => {
    if (!user || !matchId || !playerId) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('match_id', matchId)
        .eq('player_id', playerId)
        .eq('is_read', false)
        .neq('sender_id', user.id);

      if (error && __DEV__) console.error('markMessagesAsRead error:', error.message);
    } catch (error) {
      if (__DEV__) console.error('markMessagesAsRead exception:', error);
    }
  }, [user, matchId, playerId]);

  useFocusEffect(
    useCallback(() => {
      markMessagesAsRead();
    }, [markMessagesAsRead]),
  );

  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('match_id', matchId)
        .eq('player_id', playerId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        if (__DEV__) console.error('Error fetching messages:', error);
      } else if (data) {
        setMessages(data as ChatMessage[]);
      }
    } catch (error) {
      if (__DEV__) console.error('fetchMessages exception:', error);
    } finally {
      setLoading(false);
    }
  }, [matchId, playerId]);

  useEffect(() => {
    if (!user || !matchId || !playerId) return;

    const fetchContext = async () => {
      try {
        const { data: mData } = await supabase
          .from('matches')
          .select('id, organizer_id, title, date_time')
          .eq('id', matchId)
          .single();

        if (!mData) return;

        setMatchDetails(mData);
        const otherId = user.id === mData.organizer_id ? playerId : mData.organizer_id;

        const { data: uData } = await supabase
          .from('users')
          .select('*')
          .eq('id', otherId)
          .single();

        if (uData) setOtherUser(uData as UserProfile);
      } catch (error) {
        if (__DEV__) console.error('fetchContext exception:', error);
      }
    };

    fetchContext();
    fetchMessages();

    const channel = supabase
      .channel(`chat_${matchId}_${playerId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `match_id=eq.${matchId}`,
      }, async (payload) => {
        const newMsg = payload.new as ChatMessage;
        if (newMsg.player_id !== playerId) return;

        setMessages((prev) => {
          let tempIdx = -1;
          for (let i = 0; i < prev.length; i++) {
            const m = prev[i];
            if (m.id === newMsg.id) return prev;
            if (
              tempIdx === -1 &&
              m.id.startsWith('temp_') &&
              m.sender_id === newMsg.sender_id &&
              m.content === newMsg.content
            ) {
              tempIdx = i;
            }
          }
          if (tempIdx !== -1) return prev.map((m, i) => (i === tempIdx ? newMsg : m));
          return [...prev, newMsg];
        });

        if (newMsg.sender_id !== user.id) {
          await markMessagesAsRead();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMessages, markMessagesAsRead, matchId, playerId, user]);

  const handleSend = async () => {
    if (!inputText.trim() || !user || !matchId || !playerId || sending) return;

    const processedText = processMessageText(inputText);
    if (!processedText) return;

    setSending(true);
    setInputText('');

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      match_id: matchId,
      player_id: playerId,
      sender_id: user.id,
      content: processedText,
      created_at: new Date().toISOString(),
      is_read: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const { data, error } = await supabase.from('chat_messages').insert({
        match_id: matchId,
        player_id: playerId,
        sender_id: user.id,
        content: processedText,
      }).select().single();

      if (error) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        Alert.alert('No se pudo enviar', 'Inténtalo de nuevo en unos segundos.');
      } else if (data) {
        setMessages((prev) => prev.map((m) => (m.id === tempId ? (data as ChatMessage) : m)));
      }
    } catch (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      Alert.alert('No se pudo enviar', 'Inténtalo de nuevo en unos segundos.');
      if (__DEV__) console.error('handleSend exception:', error);
    } finally {
      setSending(false);
    }
  };

  const renderHeaderTitle = useCallback(() => (
    <ChatHeader
      otherUser={otherUser}
      matchDetails={matchDetails}
      onUserPress={() => otherUser && router.push(`/user/${otherUser.id}` as any)}
      onMatchPress={() => matchDetails && router.push(`/match/${matchDetails.id}` as any)}
    />
  ), [matchDetails, otherUser, router]);

  const stackScreenOptions = useMemo(() => ({
    headerTitle: renderHeaderTitle,
    title: otherUser?.full_name ?? 'Chat',
    headerStyle: { backgroundColor: c.bg },
    headerTintColor: c.text,
    headerShadowVisible: false,
    headerBackTitleVisible: false,
    headerTitleAlign: 'left' as const,
  }), [renderHeaderTitle, otherUser?.full_name]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <MessageBubble item={item} isMe={item.sender_id === user?.id} />
  ), [user?.id]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <Stack.Screen options={stackScreenOptions} />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.bg }}>
          <ActivityIndicator size="large" color={c.brand} />
        </View>
      ) : (
        <>
          <View style={{ height: 1, backgroundColor: c.border }} />
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            style={{ flex: 1, backgroundColor: c.bg }}
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 10,
            }}
            onContentSizeChange={() => scrollToEnd(true)}
            onLayout={() => scrollToEnd(false)}
            ListEmptyComponent={
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }}>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 }}>
                  Todavía no hay mensajes.
                </Text>
                <Text style={{ color: c.textDim, fontSize: 14, textAlign: 'center' }}>
                  Escribe para coordinar el partido.
                </Text>
              </View>
            }
          />

          <ChatInputBar
            value={inputText}
            sending={sending}
            bottomInset={insets.bottom}
            onChangeText={setInputText}
            onSend={handleSend}
            onFocus={() => scrollToEnd(true)}
          />
        </>
      )}
    </KeyboardAvoidingView>
  );
}
