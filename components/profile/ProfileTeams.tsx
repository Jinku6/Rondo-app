import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ProfileAvatar } from '@/components/match/MatchDetailParts';
import { useTheme } from '@/hooks/use-theme';
import type { PublicUserTeam } from '@/types/series';

interface ProfileTeamsProps {
  teams: PublicUserTeam[];
  onTeamPress: (teamId: string) => void;
}

export function ProfileTeams({ teams, onTeamPress }: ProfileTeamsProps) {
  const { colors: c } = useTheme();

  if (teams.length === 0) return null;

  return (
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
            onPress={() => onTeamPress(team.id)}
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
  );
}
