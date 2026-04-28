import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';

const TAB_ITEMS = [
  { name: 'index',     label: 'BUSCAR',   icon: (c: string) => <Ionicons name="search-outline" size={22} color={c} /> },
  { name: 'mymatches', label: 'PARTIDOS', icon: (c: string) => <Ionicons name="calendar-outline" size={22} color={c} /> },
  { name: 'messages',  label: 'MENSAJES', icon: (c: string) => <Ionicons name="chatbubbles-outline" size={22} color={c} /> },
  { name: 'profile',   label: 'PERFIL',   icon: (c: string) => <MaterialIcons name="person-outline" size={22} color={c} /> },
] as const;

const TAB_HEIGHT = 66;
const FAB_SIZE = 52;

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const HALF_WIDTH = Math.floor((screenWidth - 24 - 8 - FAB_SIZE - 8) / 2);

  const getBadge = (routeName: string): number | undefined => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return undefined;
    const opts = descriptors[route.key]?.options as { tabBarBadge?: number };
    return opts?.tabBarBadge && opts.tabBarBadge > 0 ? opts.tabBarBadge : undefined;
  };

  const navigateTo = (routeName: string) => {
    const route = state.routes.find((r) => r.name === routeName);
    if (!route) return;
    const isFocused = state.index === state.routes.indexOf(route);
    if (!isFocused) navigation.navigate(routeName);
  };

  const isActive = (routeName: string) => state.routes[state.index]?.name === routeName;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 12 + insets.bottom,
        left: 12,
        right: 12,
        height: TAB_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Platform.OS === 'ios' ? 'rgba(17,24,39,0.92)' : 'rgba(17,24,39,0.96)',
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 22,
        paddingHorizontal: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.6,
        shadowRadius: 50,
        elevation: 20,
        zIndex: 100,
      }}
    >
      {/* Left side: Buscar + Partidos */}
      <View style={{ width: HALF_WIDTH, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden' }}>
        {TAB_ITEMS.slice(0, 2).map((tab) => {
          const active = isActive(tab.name);
          const badge = getBadge(tab.name);
          const color = active ? colors.brand : colors.textDim;
          return (
            <TabButton
              key={tab.name}
              label={tab.label}
              icon={tab.icon(color)}
              active={active}
              badge={badge}
              colors={colors}
              onPress={() => navigateTo(tab.name)}
            />
          );
        })}
      </View>

      {/* Central FAB */}
      <Pressable
        onPress={() => navigateTo('create')}
        style={({ pressed }) => ({
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: 16,
          backgroundColor: colors.brand,
          alignItems: 'center',
          justifyContent: 'center',
          marginHorizontal: 2,
          flexShrink: 0,
          transform: [{ scale: pressed ? 0.93 : 1 }],
          shadowColor: colors.brand,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.5,
          shadowRadius: 24,
          elevation: 12,
        })}
        accessibilityLabel="Crear partido"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={26} color={colors.brandInk} />
      </Pressable>

      {/* Right side: Mensajes + Perfil */}
      <View style={{ width: HALF_WIDTH, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden' }}>
        {TAB_ITEMS.slice(2).map((tab) => {
          const active = isActive(tab.name);
          const badge = getBadge(tab.name);
          const color = active ? colors.brand : colors.textDim;
          return (
            <TabButton
              key={tab.name}
              label={tab.label}
              icon={tab.icon(color)}
              active={active}
              badge={badge}
              colors={colors}
              onPress={() => navigateTo(tab.name)}
            />
          );
        })}
      </View>
    </View>
  );
}

interface TabButtonProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function TabButton({ label, icon, active, badge, onPress, colors }: TabButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        opacity: pressed ? 0.75 : 1,
        position: 'relative',
      })}
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      {active && (
        <View
          style={{
            position: 'absolute',
            top: 8,
            left: '50%',
            marginLeft: -2,
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.brand,
            shadowColor: colors.brand,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 1,
            shadowRadius: 8,
          }}
        />
      )}

      {badge != null && (
        <View
          style={{
            position: 'absolute',
            top: 10,
            right: '16%',
            backgroundColor: colors.danger,
            minWidth: 15,
            height: 15,
            paddingHorizontal: 3,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}

      {icon}

      <Text
        style={{
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: active ? colors.brand : colors.textDim,
          textAlign: 'center',
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export const FLOATING_TAB_BAR_HEIGHT = TAB_HEIGHT + 56;
