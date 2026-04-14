import { Brand, Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { user } = useAuth();

  const [badgeCount, setBadgeCount] = useState<number | undefined>(undefined);
  const [matchesBadgeCount, setMatchesBadgeCount] = useState<number | undefined>(undefined);

  const fetchMatchesBadge = async () => {
    if (!user) { setMatchesBadgeCount(undefined); return; }
    const { data } = await supabase
      .from('match_participants')
      .select('id, matches!inner(organizer_id)')
      .eq('status', 'pending')
      .eq('matches.organizer_id', user.id);
    const count = data?.length ?? 0;
    setMatchesBadgeCount(count > 0 ? count : undefined);
  };

  const fetchBadgeCount = async () => {
    if (!user) {
      setBadgeCount(undefined);
      return;
    }

    // Unread chat messages via lightweight RPC
    const { data: unreadChats } = await supabase.rpc('get_unread_count');

    // Unread review notifications
    const { count: unreadNotifs } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)
      .in('type', ['pending_organizer_review', 'pending_player_review']);

    const total = (unreadChats ?? 0) + (unreadNotifs ?? 0);
    setBadgeCount(total > 0 ? total : undefined);
  };

  useEffect(() => {
    fetchBadgeCount();
    fetchMatchesBadge();

    if (!user) return;

    // Subscribe to notification changes
    const notifSub = supabase
      .channel('tab-badge-notifs')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchBadgeCount())
      .subscribe();

    // Subscribe to match_participants changes (join requests) — solo INSERTs nuevos
    const matchSub = supabase
      .channel('tab-badge-matches')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_participants' }, () => fetchMatchesBadge())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_participants' }, () => fetchMatchesBadge())
      .subscribe();

    // Subscribe to chat_messages INSERT and UPDATE (is_read changes)
    const chatSub = supabase
      .channel('tab-badge-chats')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => fetchBadgeCount())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, () => fetchBadgeCount())
      .subscribe();

    return () => {
      notifSub.unsubscribe();
      matchSub.unsubscribe();
      chatSub.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Brand.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: isDark ? theme.secondaryBackground : theme.divider,
        },
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTintColor: theme.text,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color }) => <Ionicons name="search-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Crear',
          tabBarIcon: ({ color }) => <Ionicons name="add-circle-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mymatches"
        options={{
          title: 'Mis partidos',
          tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={24} color={color} />,
          tabBarBadge: matchesBadgeCount,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Mensajes',
          tabBarIcon: ({ color }) => <Ionicons name="chatbubbles-outline" size={24} color={color} />,
          tabBarBadge: badgeCount,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color }) => <MaterialIcons name="person-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
