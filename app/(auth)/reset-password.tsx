import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator,
  Alert, Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleReset = async () => {
    if (!password) {
      Alert.alert('Campo requerido', 'Introduce tu nueva contraseña.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Contraseña muy corta', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Las contraseñas no coinciden', 'Verifica que ambas contraseñas sean iguales.');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      if (Platform.OS === 'web') {
        window.alert(`Error: ${error.message}`);
      } else {
        Alert.alert('Error', error.message);
      }
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-neutral-950 justify-center items-center px-8">
        <View className="bg-green-100 dark:bg-green-900/30 w-20 h-20 rounded-full justify-center items-center mb-6">
          <Ionicons name="checkmark-circle-outline" size={40} color="#22C55E" />
        </View>
        <Text className="text-slate-900 dark:text-white text-2xl font-bold text-center mb-3">
          Contraseña actualizada
        </Text>
        <Text className="text-slate-500 dark:text-slate-400 text-center mb-8">
          Tu contraseña ha sido cambiada correctamente. Ya puedes iniciar sesión.
        </Text>
        <TouchableOpacity
          className="w-full bg-green-500 rounded-xl p-4 items-center"
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text className="text-white font-semibold text-lg">Ir al inicio de sesión</Text>
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
        <Text className="text-slate-900 dark:text-white text-3xl font-bold mb-2">
          Nueva contraseña
        </Text>
        <Text className="text-slate-500 dark:text-slate-400 mb-8">
          Elige una nueva contraseña para tu cuenta.
        </Text>

        <Text className="text-slate-700 dark:text-slate-300 font-medium mb-1">Nueva contraseña</Text>
        <TextInput
          className="w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-3 text-gray-900 dark:text-white mb-4"
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="next"
        />

        <Text className="text-slate-700 dark:text-slate-300 font-medium mb-1">Confirmar contraseña</Text>
        <TextInput
          className="w-full bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-3 text-gray-900 dark:text-white mb-6"
          placeholder="Repite la contraseña"
          placeholderTextColor="#9ca3af"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleReset}
        />

        <TouchableOpacity
          className="w-full bg-green-500 rounded-xl p-4 items-center"
          style={{ minHeight: 48 }}
          onPress={handleReset}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text className="text-white font-semibold text-lg">Guardar contraseña</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
