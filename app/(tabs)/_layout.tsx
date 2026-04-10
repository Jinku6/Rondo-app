import { Tabs } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#22C55E',
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#0A0A0A' : '#ffffff',
          borderTopColor: colorScheme === 'dark' ? '#111827' : '#E5E7EB',
        },
        headerStyle: {
          backgroundColor: colorScheme === 'dark' ? '#0A0A0A' : '#ffffff',
        },
        headerTintColor: colorScheme === 'dark' ? '#ffffff' : '#111827',
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
          title: 'Mis Partidos',
          tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={24} color={color} />,
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
