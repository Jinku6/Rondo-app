import { useAuth } from '@/contexts/AuthContext';
import { ActivityProvider, useActivity } from '@/contexts/ActivityContext';
import { FloatingTabBar } from '@/components/rondo/FloatingTabBar';
import { supabase } from '@/lib/supabase';
import { Tabs, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { InteractionManager } from 'react-native';

function TabLayoutContent() {
  const { user } = useAuth();
  const { messagesBadgeCount, matchesBadgeCount, refreshActivity } = useActivity();
  const navigation = useNavigation();

  useEffect(() => {
    let task: ReturnType<typeof InteractionManager.runAfterInteractions> | undefined;
    const unsubscribe = navigation.addListener('focus', () => {
      task?.cancel();
      task = InteractionManager.runAfterInteractions(() => {
        void refreshActivity();
      });
    });
    return () => {
      task?.cancel();
      unsubscribe();
    };
  }, [navigation, refreshActivity]);

  useEffect(() => {
    if (!user) return;

    let active = true;
    let cleanup: (() => void) | undefined;
    const uid = Date.now();

    const task = InteractionManager.runAfterInteractions(() => {
      if (!active) return;

      const notifSub = supabase
        .channel(`tab-badge-notifs-${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
          void refreshActivity();
        })
        .subscribe();

      const matchSub = supabase
        .channel(`tab-badge-matches-${uid}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_participants' }, () => {
          void refreshActivity();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'match_participants' }, () => {
          void refreshActivity();
        })
        .subscribe();

      const chatSub = supabase
        .channel(`tab-badge-chats-${uid}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
          void refreshActivity();
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, () => {
          void refreshActivity();
        })
        .subscribe();

      cleanup = () => {
        supabase.removeChannel(notifSub);
        supabase.removeChannel(matchSub);
        supabase.removeChannel(chatSub);
      };
    });

    return () => {
      active = false;
      task.cancel();
      cleanup?.();
    };
  }, [refreshActivity, user]);

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      {/* Order: Buscar | Partidos | FAB Crear | Mensajes | Perfil */}
      <Tabs.Screen name="index"     options={{ title: 'Buscar' }} />
      <Tabs.Screen name="mymatches" options={{ title: 'Mis partidos', tabBarBadge: matchesBadgeCount }} />
      <Tabs.Screen name="create"    options={{ title: 'Crear' }} />
      <Tabs.Screen name="messages"  options={{ title: 'Mensajes', tabBarBadge: messagesBadgeCount }} />
      <Tabs.Screen name="profile"   options={{ title: 'Perfil' }} />
    </Tabs>
  );
}

export default function TabLayout() {
  const { user } = useAuth();

  return (
    <ActivityProvider user={user}>
      <TabLayoutContent />
    </ActivityProvider>
  );
}
