import { useAuth } from '@/contexts/AuthContext';
import { processMessageText } from '@/lib/messageFilter';
import { supabase } from '@/lib/supabase';
import { ChatMessage, UserProfile } from '@/types/database';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView,
  Platform, Text, TextInput, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isSafeUrl } from '@/lib/utils';

export default function ChatScreen() {
  const { match_id, player_id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();

  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [matchDetails, setMatchDetails] = useState<{ organizer_id: string; title: string; id: string; date_time: string } | null>(null);
  const [otherUser, setOtherUser] = useState<UserProfile | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Mark all unread messages as read in this thread
  const markMessagesAsRead = useCallback(async () => {
    if (!user || !match_id || !player_id) return;
    const { error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('match_id', match_id)
      .eq('player_id', player_id)
      .eq('is_read', false)
      .neq('sender_id', user.id);
    if (error && __DEV__) console.error('markMessagesAsRead error:', error.message);
  }, [user, match_id, player_id]);

  // Fires every time this screen gets focus (also on initial mount)
  useFocusEffect(
    useCallback(() => {
      markMessagesAsRead();
    }, [markMessagesAsRead])
  );

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('match_id', match_id)
      .eq('player_id', player_id)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      if (__DEV__) console.error('Error fetching messages:', error);
    } else if (data) {
      setMessages(data as ChatMessage[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user || !match_id || !player_id) return;

    const fetchContext = async () => {
      const { data: mData } = await supabase
        .from('matches')
        .select('id, organizer_id, title, date_time')
        .eq('id', match_id)
        .single();

      if (mData) {
        setMatchDetails(mData);
        const otherId = user.id === mData.organizer_id
          ? (player_id as string)
          : mData.organizer_id;

        const { data: uData } = await supabase
          .from('users')
          .select('*')
          .eq('id', otherId)
          .single();
        if (uData) setOtherUser(uData as UserProfile);
      }
    };

    fetchContext();
    fetchMessages();

    const channel = supabase
      .channel(`chat_${match_id}_${player_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `match_id=eq.${match_id}`,
      }, async (payload) => {
        const newMsg = payload.new as ChatMessage;
        if (newMsg.player_id === player_id) {
          setMessages((prev) => {
            // Single pass: find existing real ID or matching temp (optimistic dedup)
            let tempIdx = -1;
            for (let i = 0; i < prev.length; i++) {
              const m = prev[i];
              if (m.id === newMsg.id) return prev;
              if (tempIdx === -1 && m.id.startsWith('temp_') && m.sender_id === newMsg.sender_id && m.content === newMsg.content) tempIdx = i;
            }
            if (tempIdx !== -1) return prev.map((m, i) => i === tempIdx ? newMsg : m);
            return [...prev, newMsg];
          });
          // If the screen is active and the message is from the other person, mark as read immediately
          if (newMsg.sender_id !== user?.id) {
            await markMessagesAsRead();
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, match_id, player_id]);

  const handleSend = async () => {
    if (!inputText.trim() || !user || !match_id || !player_id || sending) return;
    const processedText = processMessageText(inputText);
    if (!processedText) return;

    setSending(true);
    setInputText('');

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      match_id: match_id as string,
      player_id: player_id as string,
      sender_id: user.id,
      content: processedText,
      created_at: new Date().toISOString(),
      is_read: true,
    };
    setMessages(prev => [...prev, optimisticMsg]);

    const { data, error } = await supabase.from('chat_messages').insert({
      match_id: match_id as string,
      player_id: player_id as string,
      sender_id: user.id,
      content: processedText,
    }).select().single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Error al enviar', error.message);
    } else if (data) {
      setMessages(prev => prev.map(m => m.id === tempId ? (data as ChatMessage) : m));
    }
    setSending(false);
  };

  // ── Header ──
  const renderHeaderTitle = useCallback(() => {
    if (!otherUser) return null;
    const matchDate = matchDetails?.date_time
      ? new Date(matchDetails.date_time).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
      : null;

    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8, overflow: 'hidden' }}>
        {/* Avatar + nombre → perfil */}
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}
          activeOpacity={0.7}
          onPress={() => router.push(`/user/${otherUser.id}` as any)}
        >
          {isSafeUrl(otherUser.avatar_url) ? (
            <Image
              source={{ uri: `${otherUser.avatar_url}?t=${Date.now()}` }}
              style={{ width: 36, height: 36, borderRadius: 18, flexShrink: 0 }}
            />
          ) : (
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#dcfce7', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
              <Text style={{ fontWeight: 'bold', color: '#16a34a', fontSize: 15 }}>
                {otherUser.full_name?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={{ marginLeft: 8, flex: 1, minWidth: 0 }}>
            <Text style={{ fontWeight: 'bold', fontSize: 14, color: isDark ? '#ffffff' : '#0f172a', lineHeight: 18 }} numberOfLines={1}>
              {otherUser.full_name}
            </Text>
            {otherUser.username && (
              <Text style={{ fontSize: 11, color: '#9ca3af', lineHeight: 15 }} numberOfLines={1}>
                @{otherUser.username}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Partido → detalle del partido */}
        {matchDetails && (
          <TouchableOpacity
            onPress={() => router.push(`/match/${matchDetails.id}` as any)}
            activeOpacity={0.7}
            style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, alignItems: 'center', flexShrink: 0, maxWidth: 130 }}
          >
            <Ionicons name="football-outline" size={11} color="#16a34a" />
            <Text style={{ color: '#15803d', fontSize: 10, fontWeight: 'bold', marginTop: 2, textAlign: 'center' }} numberOfLines={1}>
              {matchDetails.title}
            </Text>
            {matchDate && (
              <Text style={{ color: '#16a34a', fontSize: 9, textAlign: 'center', opacity: 0.7 }} numberOfLines={1}>
                {matchDate}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUser, matchDetails]);

  // ── Message bubble ──
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.sender_id === user?.id;
    return (
      <View className={`mb-2.5 max-w-[80%] ${isMe ? 'self-end' : 'self-start'}`}>
        <View className={`px-3.5 py-2.5 ${
          isMe
            ? 'bg-green-500 rounded-2xl rounded-br-sm'
            : 'bg-white dark:bg-gray-800 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100 dark:border-gray-700'
        }`}>
          <Text className={isMe ? 'text-white text-[15px]' : 'text-slate-800 dark:text-white text-[15px]'}>
            {item.content}
          </Text>
        </View>
        <Text className={`text-[10px] text-gray-400 mt-0.5 ${isMe ? 'text-right mr-1' : 'text-left ml-1'}`}>
          {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50 dark:bg-neutral-950"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 60}
    >
      <Stack.Screen
        options={{
          headerTitle: renderHeaderTitle,
          title: otherUser?.full_name ?? 'Chat',
        }}
      />

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#22C55E" />
        </View>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center mt-20">
                <View className="bg-slate-200 dark:bg-gray-800 rounded-full w-16 h-16 justify-center items-center mb-4">
                  <Ionicons name="chatbubbles-outline" size={32} color="#9ca3af" />
                </View>
                <Text className="text-slate-500 dark:text-gray-400 text-center px-8">
                  Este es el comienzo del chat. Recuerda mantener un ambiente de respeto.
                </Text>
              </View>
            }
          />

          <View
            className="px-3 pt-2 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex-row items-end"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
          >
            <TextInput
              className="flex-1 bg-slate-100 dark:bg-gray-800 text-slate-900 dark:text-white px-4 py-2.5 rounded-2xl mr-2 max-h-28"
              placeholder="Escribe un mensaje..."
              placeholderTextColor="#9ca3af"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onFocus={() => setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300)}
            />
            <TouchableOpacity
              className={`w-11 h-11 rounded-full justify-center items-center ${inputText.trim() ? 'bg-green-500' : 'bg-green-300 dark:bg-green-900'}`}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
            >
              <Ionicons name="send" size={18} color="#fff" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
