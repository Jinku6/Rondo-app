import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ProfileOverview } from '@/components/profile/ProfileOverview';
import { ProfileAvatar } from '@/components/match/MatchDetailParts';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { PUBLIC_USER_SELECT } from '@/lib/supabase/selects';
import { firstParam, isValidUUID } from '@/lib/utils';
import { logSupabaseError } from '@/lib/supabaseErrors';
import { UserProfile } from '@/types/database';
import type { PublicUserTeam } from '@/types/series';

export default function UserProfileScreen() {
  const { colors: c } = useTheme();
  const params = useLocalSearchParams();
  const id = firstParam(params.id as string | string[]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [teams, setTeams] = useState<PublicUserTeam[]>([]);
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
        const [profileResult, teamsResult] = await Promise.all([
          supabase
            .from('users')
            .select(PUBLIC_USER_SELECT)
            .eq('id', id)
            .single(),
          supabase.rpc('get_public_user_teams', { p_user_id: id }),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (teamsResult.error) {
          logSupabaseError('fetch public user teams', teamsResult.error);
        }
        if (active && profileResult.data) {
          setProfile({ ...profileResult.data, birthday: null } as UserProfile);
          setTeams((teamsResult.data ?? []) as PublicUserTeam[]);
        }
      } catch (error) {
        logSupabaseError('fetch user profile', error);
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

        {teams.length > 0 && (
          <View style={{ marginTop: 20, marginBottom: 10 }}>
            <Text style={{
              color: c.textDim,
              fontFamily: 'JetBrainsMono_500Medium',
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}>
              Equipos
            </Text>
            <View style={{ gap: 10 }}>
              {teams.map(team => (
                <TouchableOpacity
                  key={team.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir equipo ${team.title}`}
                  activeOpacity={0.72}
                  onPress={() => router.push(`/group/${team.id}` as never)}
                  style={{
                    minHeight: 68,
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 14,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.bgSurface,
                  }}
                >
                  <ProfileAvatar name={team.title} avatarUrl={team.avatar_url} size={44} textSize={14} />
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                    <Text style={{ color: c.text, fontSize: 15, fontWeight: '800' }} numberOfLines={1}>
                      {team.title}
                    </Text>
                    {!!team.city && (
                      <Text style={{ color: c.textDim, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                        {team.city}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.brand} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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
