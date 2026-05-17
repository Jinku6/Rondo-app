import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Text, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';

const LEFT_TABS = [
  { name: 'index',     label: 'BUSCAR',   icon: 'search-outline' },
  { name: 'mymatches', label: 'PARTIDOS', icon: 'calendar-outline' },
] as const;

const RIGHT_TABS = [
  { name: 'messages', label: 'MENSAJES', icon: 'chatbubbles-outline' },
  { name: 'profile',  label: 'PERFIL',   icon: 'person-outline' },
] as const;

const TAB_H = 66;
const FAB_SIZE = 52;
const FAB_FLOAT_OFFSET = -18;

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const routeIndex = (name: string) => state.routes.findIndex((r) => r.name === name);
  const isActive = (name: string) => state.routes[state.index]?.name === name;

  const getBadge = (name: string): number | undefined => {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return undefined;
    const opts = descriptors[route.key]?.options as { tabBarBadge?: number };
    return typeof opts?.tabBarBadge === 'number' && opts.tabBarBadge > 0 ? opts.tabBarBadge : undefined;
  };

  const go = (name: string) => {
    const idx = routeIndex(name);
    if (idx < 0) return;
    const event = navigation.emit({ type: 'tabPress', target: state.routes[idx].key, canPreventDefault: true });
    if (!isActive(name) && !event.defaultPrevented) navigation.navigate(name);
  };

  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: insets.bottom + 8,
        height: TAB_H,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.tabBarBg,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.55,
        shadowRadius: 30,
        elevation: 24,
        zIndex: 999,
      }}
    >
      {LEFT_TABS.map((tab) => (
        <TabBtn
          key={tab.name}
          label={tab.label}
          iconName={tab.icon}
          active={isActive(tab.name)}
          badge={getBadge(tab.name)}
          brandColor={colors.brand}
          dangerColor={colors.danger}
          dimColor={colors.textDim}
          badgeBorderColor={colors.bgElev}
          onPress={() => go(tab.name)}
        />
      ))}

      {/* Central FAB */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => go('create')}
          style={{
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: 16,
            backgroundColor: colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: 'rgba(34,197,94,0.32)',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 1,
            shadowRadius: 24,
            elevation: 8,
            borderColor: colors.bg,
            borderWidth: 4,
            marginTop: FAB_FLOAT_OFFSET,
          }}
          accessibilityLabel="Crear partido"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {RIGHT_TABS.map((tab) => (
        <TabBtn
          key={tab.name}
          label={tab.label}
          iconName={tab.icon}
          isMaterial={tab.name === 'profile'}
          active={isActive(tab.name)}
          badge={getBadge(tab.name)}
          brandColor={colors.brand}
          dangerColor={colors.danger}
          dimColor={colors.textDim}
          badgeBorderColor={colors.bgElev}
          onPress={() => go(tab.name)}
        />
      ))}
    </View>
  );
}

interface TabBtnProps {
  label: string;
  iconName: any;
  isMaterial?: boolean;
  active: boolean;
  badge?: number;
  brandColor: string;
  dangerColor: string;
  dimColor: string;
  badgeBorderColor: string;
  onPress: () => void;
}

function TabBtn({ label, iconName, isMaterial, active, badge, brandColor, dangerColor, dimColor, badgeBorderColor, onPress }: TabBtnProps) {
  const color = active ? brandColor : dimColor;

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      style={{
        flex: 1,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <View style={{ position: 'relative' }}>
        {isMaterial ? (
          <MaterialIcons name={iconName} size={24} color={color} style={active ? {
            textShadowColor: 'rgba(34,197,94,0.4)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 8,
          } : undefined} />
        ) : (
          <Ionicons name={iconName} size={24} color={color} style={active ? {
            textShadowColor: 'rgba(34,197,94,0.4)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 8,
          } : undefined} />
        )}

        {/* Badge */}
        {badge != null && (
          <View style={{
            position: 'absolute',
            top: -4,
            right: -8,
            backgroundColor: dangerColor,
            minWidth: 16,
            height: 16,
            paddingHorizontal: 4,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
            borderWidth: 1.5,
            borderColor: badgeBorderColor,
          }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold', textAlign: 'center' }}>
              {badge > 99 ? '99+' : String(badge)}
            </Text>
          </View>
        )}
      </View>

      <Text
        numberOfLines={1}
        style={{
          fontSize: 9,
          fontFamily: 'JetBrainsMono_500Medium',
          letterSpacing: 0.72,
          textTransform: 'uppercase',
          color: color,
          ...(active ? {
            textShadowColor: 'rgba(34,197,94,0.4)',
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 8,
          } : {})
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export const FLOATING_TAB_BAR_HEIGHT = TAB_H + 64;
