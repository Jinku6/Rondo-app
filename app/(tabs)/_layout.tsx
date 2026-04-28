import { useAuth } from '@/contexts/AuthContext';
import { FloatingTabBar } from '@/components/rondo/FloatingTabBar';
import { supabase } from '@/lib/supabase';
import { Tabs, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';

export default function TabLayout() {
  const { user } = useAuth();
  const navigation = useNavigation();

  const [badgeCount, setBadgeCount] = useState<number | undefined>(undefined);
  const [matchesBadgeCount, setMatchesBadgeCount] = useState<number | undefined>(undefined);

  const fetchMatchesBadge = async () => {
    if (!user) { setMatchesBadgeCount(undefined); return; }
    const { data: myMatches } = await supabase
      .from('matches')
      .select('id')
      .eq('organizer_id', user.id);
    if (!myMatches?.length) { setMatchesBadgeCount(undefined); return; }
    const matchIds = myMatches.map((m: { id: string }) => m.id);
    const { data } = await supabase
      .from('match_participants')
      .select('id')
      .in('match_id', matchIds)
      .eq('status', 'pending');
    const count = data?.length ?? 0;
    setMatchesBadgeCount(count > 0 ? count : undefined);
  };

  const fetchBadgeCount = async () => {
    if (!user) { setBadgeCount(undefined); return; }
    const { data: unreadChats } = await supabase.rpc('get_unread_count');
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

    const uid = Date.now();

    const notifSub = supabase
      .channel(`tab-badge-notifs-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchBadgeCount())
      .subscribe();

    const matchSub = supabase
      .channel(`tab-badge-matches-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_participants' }, () => fetchMatchesBadge())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_participants' }, () => fetchMatchesBadge())
      .subscribe();

    const chatSub = supabase
      .channel(`tab-badge-chats-${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => fetchBadgeCount())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, () => fetchBadgeCount())
      .subscribe();

    return () => {
      supabase.removeChannel(notifSub);
      supabase.removeChannel(matchSub);
      supabase.removeChannel(chatSub);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchBadgeCount();
      fetchMatchesBadge();
    });
    return unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, user]);

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      {/* Order: Buscar | Partidos | FAB Crear | Mensajes | Perfil */}
      <Tabs.Screen name="index"     options={{ title: 'Buscar' }} />
      <Tabs.Screen name="mymatches" options={{ title: 'Mis partidos', tabBarBadge: matchesBadgeCount }} />
      <Tabs.Screen name="create"    options={{ title: 'Crear' }} />
      <Tabs.Screen name="messages"  options={{ title: 'Mensajes', tabBarBadge: badgeCount }} />
      <Tabs.Screen name="profile"   options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
