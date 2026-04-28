import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export const HomeHero: React.FC = () => {
  const { profile } = useAuth();
  const router = useRouter();
  const firstName = profile?.full_name?.split(' ')[0];

  return (
    <View
      style={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#166534',
        minHeight: 230,
        flexShrink: 0,
        paddingBottom: 60,
      }}
    >
      {/* Green gradient overlay */}
      <View
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#22C55E', opacity: 0.35 }}
        pointerEvents="none"
      />
      <View
        style={{ position: 'absolute', bottom: -30, right: -30, width: 200, height: 200, borderRadius: 100, backgroundColor: '#4ade80', opacity: 0.3 }}
        pointerEvents="none"
      />
      {/* Top glow */}
      <View
        style={{ position: 'absolute', top: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: '#fff', opacity: 0.08 }}
        pointerEvents="none"
      />

      {/* Topbar: logo icon + wordmark + actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 10, zIndex: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Image
            source={require('@/assets/images/rondo-icon-white.png')}
            style={{ width: 28, height: 28 }}
            resizeMode="contain"
          />
          <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 }}>
            Rondo
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' }}
            onPress={() => router.push('/search/results')}
          >
            <Ionicons name="notifications-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' }}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 13, fontWeight: '900', color: '#fff' }}>
              {firstName?.[0]?.toUpperCase() ?? 'J'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Body */}
      <View style={{ paddingHorizontal: 18, paddingTop: 14, zIndex: 2 }}>
        <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.75)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
          Conecta. Juega. Repite.
        </Text>
        <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 28, fontWeight: '900', color: '#fff', lineHeight: 30, letterSpacing: -0.5, maxWidth: 230 }}>
          Tu próximo{'\n'}partido te espera
        </Text>
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontFamily: 'Archivo_700Bold', fontSize: 18, color: '#fff', fontWeight: '700' }}>
            {firstName ? `¡Hola, ${firstName}!` : '¡Bienvenido!'}
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>
            Busca partidos cerca de ti.
          </Text>
        </View>
      </View>

      {/* Decorative ball */}
      <View
        style={{ position: 'absolute', bottom: -15, right: -15, zIndex: 1, transform: [{ rotate: '-12deg' }] }}
        pointerEvents="none"
      >
        <Text style={{ fontSize: 110, lineHeight: 130, opacity: 0.9 }}>⚽</Text>
      </View>
    </View>
  );
};
