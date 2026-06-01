import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  View,
} from 'react-native';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email('El correo electrónico ingresado no es válido'),
  password: z.string().min(1, 'Debes ingresar tu contraseña'),
});

const translateError = (msg: string): string => {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Email o contraseña incorrectos',
    'Email not confirmed': 'Debes confirmar tu email antes de iniciar sesión',
    'Invalid email or password': 'Email o contraseña incorrectos',
    'Too many requests': 'Demasiados intentos. Espera un momento',
    'Network request failed': 'Error de conexión. Comprueba tu internet',
    'Email rate limit exceeded': 'Has superado el límite de intentos. Espera unos minutos',
  };
  for (const [key, value] of Object.entries(map)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return 'Credenciales incorrectas. Revisa tu email y contraseña.';
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();

  async function handleLogin() {
    const normalizedEmail = email.trim().toLowerCase();
    try {
      LoginSchema.parse({ email: normalizedEmail, password });
    } catch (err) {
      if (err instanceof z.ZodError) {
        Alert.alert('Error', err.issues[0].message);
        return;
      }
    }
    setLoading(true);
    const { error } = await signIn(normalizedEmail, password);
    setLoading(false);
    if (error) {
      Alert.alert('Error', translateError(error));
    } else {
      router.replace('/(tabs)');
    }
  }

  const { colors: c } = useTheme();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo + radial glow */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View style={{
              width: 160, height: 160, alignItems: 'center', justifyContent: 'center',
              shadowColor: c.brand, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 60,
            }}>
              <Image
                source={require('@/assets/images/rondo-icon.png')}
                style={{ width: 140, height: 140 }}
                resizeMode="contain"
              />
            </View>
            <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 44, fontWeight: '900', color: c.brand, letterSpacing: -1, marginTop: 8 }}>
              Rondo
            </Text>
            <Text style={{ fontSize: 13, color: c.textDim, marginTop: 4 }}>
              Organiza y encuentra partidos ⚽
            </Text>
          </View>

          <View style={{ gap: 16 }}>
            {/* Email */}
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: c.textDim, marginBottom: 7 }}>
                Email
              </Text>
              <TextInput
                style={{
                  width: '100%', padding: 14, backgroundColor: 'rgba(255,255,255,0.04)',
                  borderWidth: 1, borderColor: c.border, borderRadius: 14,
                  color: c.text, fontSize: 15, fontWeight: '500',
                }}
                placeholder="tu@email.com"
                placeholderTextColor={c.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', color: c.textDim }}>
                  Contraseña
                </Text>
                <Link href="/(auth)/forgot-password" asChild>
                  <TouchableOpacity>
                    <Text style={{ fontSize: 12, color: c.brand, fontWeight: '600' }}>¿Olvidaste tu contraseña?</Text>
                  </TouchableOpacity>
                </Link>
              </View>
              <View style={{ position: 'relative' }}>
                <TextInput
                  style={{
                    width: '100%', padding: 14, paddingRight: 48, backgroundColor: 'rgba(255,255,255,0.04)',
                    borderWidth: 1, borderColor: c.border, borderRadius: 14,
                    color: c.text, fontSize: 15, fontWeight: '500',
                  }}
                  placeholder="••••••••"
                  placeholderTextColor={c.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.textDim} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Primary CTA */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              style={{
                backgroundColor: c.brand, borderRadius: 14, minHeight: 52,
                alignItems: 'center', justifyContent: 'center', marginTop: 8,
                shadowColor: c.brand, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 24,
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Entrar a jugar
                </Text>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              <Text style={{ color: c.textMuted, fontSize: 12 }}>o</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            </View>

            {/* Google */}
            <TouchableOpacity
              onPress={signInWithGoogle}
              style={{
                borderRadius: 14, minHeight: 52, alignItems: 'center', justifyContent: 'center',
                flexDirection: 'row', gap: 10,
                backgroundColor: c.inputBg, borderWidth: 1, borderColor: c.border,
              }}
            >
              <Ionicons name="logo-google" size={20} color="#4285F4" />
              <Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>Continuar con Google</Text>
            </TouchableOpacity>

            <AppleSignInButton />
          </View>

          {/* Footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 32 }}>
            <Text style={{ color: c.textDim, fontSize: 14 }}>¿No tienes cuenta? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={{ color: c.brand, fontWeight: '700', fontSize: 14 }}>Únete al equipo</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
