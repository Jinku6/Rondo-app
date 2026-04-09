import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, ScrollView, Keyboard } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email('El correo electrónico ingresado no es válido'),
  password: z.string().min(1, 'Debes ingresar tu contraseña')
});

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// Mapa de errores de Supabase a español
const translateError = (msg: string): string => {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Email o contraseña incorrectos',
    'Email not confirmed': 'Debes confirmar tu email antes de iniciar sesión',
    'Invalid email or password': 'Email o contraseña incorrectos',
    'User not found': 'No se encontró ningún usuario con ese email',
    'Too many requests': 'Demasiados intentos. Espera un momento',
    'Network request failed': 'Error de conexión. Comprueba tu internet',
    'Email rate limit exceeded': 'Has superado el límite de intentos. Espera unos minutos',
    'For security purposes, you can only request this after': 'Por seguridad, debes esperar antes de volver a intentarlo',
  };

  for (const [key, value] of Object.entries(map)) {
    if (msg.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return msg;
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();

  async function handleLogin() {
    try {
      LoginSchema.parse({ email, password });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        showAlert('Error', err.issues[0].message);
        return;
      }
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      console.error("Error iniciar sesión:", error);
      showAlert('Error', translateError(error));
    } else {
      router.replace('/(tabs)');
    }
  }

  return (
    <KeyboardAvoidingView 
      className="flex-1" 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView 
          className="flex-1 bg-white dark:bg-neutral-950" 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-3xl font-bold mb-8 text-center text-slate-900 dark:text-white">
            Bienvenido a Rondo
          </Text>

          <View className="space-y-4">
            <View>
              <Text className="text-slate-700 dark:text-slate-300 font-medium mb-1">Email</Text>
              <TextInput
                className="w-full bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-3 text-gray-900 dark:text-white"
                placeholder="tu@email.com"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
              />
            </View>

            <View>
              <Text className="text-slate-700 dark:text-slate-300 font-medium mb-1">Contraseña</Text>
              <TextInput
                className="w-full bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-3 text-gray-900 dark:text-white"
                placeholder="********"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <TouchableOpacity 
              className="w-full bg-green-500 rounded-xl p-4 mt-4 items-center" style={{ minHeight: 48 }}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-semibold text-lg">Ingresar</Text>
              )}
            </TouchableOpacity>

            <View className="flex-row items-center my-4 opacity-50">
              <View className="flex-1 h-[1px] bg-slate-400" />
              <Text className="mx-4 text-slate-500 font-medium">O</Text>
              <View className="flex-1 h-[1px] bg-slate-400" />
            </View>

            <TouchableOpacity 
              className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 items-center flex-row justify-center"
              onPress={signInWithGoogle}
            >
              <Ionicons name="logo-google" size={20} color="#ea4335" />
              <Text className="text-slate-700 dark:text-white font-medium text-lg ml-3">Continuar con Google</Text>
            </TouchableOpacity>

            <View className="flex-row justify-center mt-6">
              <Text className="text-slate-600 dark:text-slate-400">¿No tienes cuenta? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text className="text-green-500 font-medium">Regístrate</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
