import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ProfileOverview } from '@/components/profile/ProfileOverview';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PUBLIC_USER_SELECT } from '@/lib/supabase/selects';
import { firstParam, isValidUUID } from '@/lib/utils';
import { UserProfile } from '@/types/database';

const c = Colors;

export default function UserProfileScreen() {
  const params = useLocalSearchParams();
  const id = firstParam(params.id as string | string[]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isOwnProfile = user?.id === id;

  useEffect(() => {
    let active = true;

    const fetchProfile = async () => {
      if (!isValidUUID(id)) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select(PUBLIC_USER_SELECT)
          .eq('id', id)
          .single();

        if (error) throw error;
        if (active && data) setProfile({ ...data, birthday: null } as UserProfile);
      } catch (error) {
        if (__DEV__) console.warn('fetch user profile error:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchProfile();
    return () => { active = false; };
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={c.brand} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="person-outline" size={48} color={c.textMuted} style={{ marginBottom: 12 }} />
        <Text style={{ fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 6 }}>Usuario no encontrado</Text>
        <Text style={{ fontSize: 14, color: c.textDim, textAlign: 'center' }}>Este perfil no existe o ha sido eliminado.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: insets.top + 16,
          paddingBottom: FLOATING_TAB_BAR_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Volver"
          activeOpacity={0.75}
          onPress={() => router.back()}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10, marginBottom: 8 }}
        >
          <Ionicons name="chevron-back" size={26} color={c.text} />
        </TouchableOpacity>

        <Text style={{ fontSize: 12, color: c.textDim, letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 4 }}>
          Perfil
        </Text>
        <View style={{ marginBottom: 20 }}>
          <ScreenTitle>
            Perfil
          </ScreenTitle>
        </View>

        <ProfileOverview profile={profile} />

        {isOwnProfile && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Editar mi perfil"
            activeOpacity={0.75}
            onPress={() => router.push('/(tabs)/profile')}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: 'center',
              marginTop: 4,
              marginBottom: 10,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>Editar perfil</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}
