import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Campo requerido', 'Introduce tu correo electrónico.');
      return;
    }

    setLoading(true);
    const redirectTo = Linking.createURL('/reset-password');
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo,
    });
    setLoading(false);

    if (error) {
      if (Platform.OS === 'web') {
        window.alert(`Error: ${error.message}`);
      } else {
        Alert.alert('Error', error.message);
      }
    } else {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-neutral-950 justify-center items-center px-8">
        <View className="bg-green-100 dark:bg-green-900/30 w-20 h-20 rounded-full justify-center items-center mb-6">
          <Ionicons name="mail-outline" size={40} color="#22C55E" />
        </View>
        <Text className="text-slate-900 dark:text-white text-2xl font-bold text-center mb-3">
          Revisa tu correo
        </Text>
        <Text className="text-slate-500 dark:text-slate-400 text-center mb-8">
          Hemos enviado un enlace de recuperación a{' '}
          <Text className="font-semibold text-slate-700 dark:text-slate-200">{email}</Text>.
          {'\n\n'}Pulsa el enlace del correo para crear una nueva contraseña.
        </Text>
        <TouchableOpacity
          className="w-full bg-green-500 rounded-xl p-4 items-center"
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text className="text-white font-semibold text-lg">Volver al inicio de sesión</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-slate-50 dark:bg-neutral-950"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          className="flex-row items-center mb-8"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#22C55E" />
          <Text className="text-green-500 font-medium ml-1">Volver</Text>
        </TouchableOpacity>

        <Text className="text-slate-900 dark:text-white text-3xl font-bold mb-2">
          Recuperar contraseña
        </Text>
        <Text className="text-slate-500 dark:text-slate-400 mb-8">
          Introduce tu correo y te enviaremos un enlace para crear una nueva contraseña.
        </Text>

        <Text className="text-slate-700 dark:text-slate-300 font-medium mb-1">Correo electrónico</Text>
        <TextInput
          className="w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-3 text-gray-900 dark:text-white mb-6"
          placeholder="tu@email.com"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="send"
          onSubmitEditing={handleSend}
        />

        <TouchableOpacity
          className="w-full bg-green-500 rounded-xl p-4 items-center"
          style={{ minHeight: 48 }}
          onPress={handleSend}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white font-semibold text-lg">Enviar enlace</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
