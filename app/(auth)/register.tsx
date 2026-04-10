import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, ActivityIndicator, Alert, ScrollView, Platform, KeyboardAvoidingView, Keyboard } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';

const RegisterSchema = z.object({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  username: z.string().min(3, 'El nombre de usuario debe tener mínimo 3 caracteres'),
  preferredPosition: z.string().min(1, 'Debes seleccionar una posición'),
  email: z.string().email('El correo electrónico no es válido'),
  password: z.string()
    .min(6, 'La contraseña debe tener mínimo 6 caracteres')
    .regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula')
    .regex(/\d/, 'La contraseña debe incluir al menos un número'),
});

const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
    onOk?.();
  } else {
    Alert.alert(title, message, [{ text: 'Aceptar', onPress: onOk }]);
  }
};

const POSITIONS = ['portero', 'defensa', 'mediocentro', 'delantero'];

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [preferredPosition, setPreferredPosition] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false); // Para resaltar campos vacíos
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();

  const checkUsername = async (val: string) => {
    setUsername(val);
    if (val.length < 3) {
      setUsernameError('Mínimo 3 caracteres');
      return;
    }
    
    setUsernameChecking(true);
    const { data } = await supabase.from('users').select('id').eq('username', val.toLowerCase()).maybeSingle();
    
    if (data) setUsernameError('El usuario ya está en uso');
    else setUsernameError('');
    setUsernameChecking(false);
  };

  const validatePassword = (pwd: string) => ({
    minLength: pwd.length >= 6,
    hasUpperCase: /[A-Z]/.test(pwd),
    hasNumber: /\d/.test(pwd)
  });

  const isFieldError = (value: string) => submitted && !value.trim();

  async function handleRegister() {
    setSubmitted(true);

    try {
      RegisterSchema.parse({
        fullName,
        username,
        preferredPosition,
        email,
        password
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        showAlert('Error de validación', err.issues[0].message);
        return;
      }
    }

    if (usernameError) {
      showAlert('Error', 'Corrige el nombre de usuario');
      return;
    }

    setLoading(true);
    
    // #3 Validar pre-existencia de email
    const { data: emailExists } = await supabase.rpc('email_exists', { search_email: email.toLowerCase() });
    if (emailExists) {
      setLoading(false);
      showAlert('Error', 'Este correo electrónico ya está registrado.');
      return;
    }

    const { error } = await signUp(email, password, username.toLowerCase(), fullName, preferredPosition);
    setLoading(false);

    if (error) {
      console.error("Error de registro:", error);
      showAlert('Error de registro', error);
    } else {
      // #3: Mensaje de confirmación de email
      showAlert(
        '¡Registro exitoso!', 
        'Te hemos enviado un email de confirmación. Revisa tu bandeja de entrada y confirma tu cuenta antes de iniciar sesión.',
        () => router.replace('/(auth)/login')
      );
    }
  }

  const pwdValidation = validatePassword(password);
  const fieldBorder = (hasError: boolean) => hasError ? 'border-red-500' : 'border-slate-200 dark:border-slate-700';

  const TouchWrapper: any = Platform.OS === 'web' ? View : TouchableWithoutFeedback;
  const touchProps = Platform.OS === 'web' ? { style: {flex: 1} } : { onPress: Keyboard.dismiss, accessible: false, style: {flex: 1} };

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchWrapper {...touchProps}>
        <ScrollView 
          className="flex-1 bg-white dark:bg-neutral-950 p-6" 
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-3xl font-bold mt-10 mb-8 text-center text-slate-900 dark:text-white">
            Únete a Rondo
          </Text>

          <View className="space-y-4">
            {/* Nombre Completo */}
            <View>
              <Text className={`font-medium mb-1 ${isFieldError(fullName) ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                Nombre Completo {isFieldError(fullName) && '*'}
              </Text>
              <TextInput
                className={`w-full bg-slate-50 dark:bg-slate-800 border ${fieldBorder(isFieldError(fullName))} rounded-lg p-3 text-slate-900 dark:text-white`}
                placeholder="Juan Pérez"
                placeholderTextColor="#9ca3af"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            {/* Nombre de Usuario */}
            <View>
              <Text className={`font-medium mb-1 ${isFieldError(username) || usernameError ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                Nombre de Usuario {isFieldError(username) && '*'}
              </Text>
              <View className="relative justify-center">
                <TextInput
                  className={`w-full bg-slate-50 dark:bg-slate-800 border ${fieldBorder(isFieldError(username) || !!usernameError)} rounded-lg p-3 text-slate-900 dark:text-white`}
                  placeholder="juanp"
                  placeholderTextColor="#9ca3af"
                  value={username}
                  onChangeText={checkUsername}
                  autoCapitalize="none"
                />
                <View className="absolute right-3">
                  {usernameChecking && <ActivityIndicator size="small" color="#64748b" />}
                  {!usernameChecking && username.length >= 3 && !usernameError && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
                  {!usernameChecking && usernameError !== '' && <Ionicons name="close-circle" size={20} color="#ef4444" />}
                </View>
              </View>
              {usernameError !== '' && <Text className="text-red-500 text-xs mt-1">{usernameError}</Text>}
            </View>

            {/* Posición Preferida */}
            <View>
              <Text className={`font-medium mb-1 ${submitted && !preferredPosition ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                Tu Posición Preferida {submitted && !preferredPosition && '*'}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {POSITIONS.map(pos => (
                  <TouchableOpacity 
                    key={pos} 
                    onPress={() => setPreferredPosition(pos)} 
                    className={`px-4 py-2 rounded-full border ${
                      preferredPosition === pos 
                        ? 'bg-green-500 border-green-500' 
                        : submitted && !preferredPosition 
                          ? 'bg-slate-100 dark:bg-slate-800 border-red-500' 
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                    }`}>
                    <Text className={`capitalize font-medium ${preferredPosition === pos ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>{pos}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Email */}
            <View>
              <Text className={`font-medium mb-1 ${isFieldError(email) ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                Email {isFieldError(email) && '*'}
              </Text>
              <TextInput
                className={`w-full bg-slate-50 dark:bg-slate-800 border ${fieldBorder(isFieldError(email))} rounded-lg p-3 text-slate-900 dark:text-white`}
                placeholder="tu@email.com"
                placeholderTextColor="#9ca3af"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Contraseña */}
            <View>
              <Text className={`font-medium mb-1 ${isFieldError(password) ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                Contraseña {isFieldError(password) && '*'}
              </Text>
              <TextInput
                className={`w-full bg-slate-50 dark:bg-slate-800 border ${fieldBorder(isFieldError(password))} rounded-lg p-3 mb-2 text-slate-900 dark:text-white`}
                placeholder="Introduce tu contraseña"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <View className="flex-row items-center mb-1">
                <Ionicons name={pwdValidation.minLength ? "checkmark-circle" : "ellipse-outline"} size={14} color={pwdValidation.minLength ? "#10b981" : submitted && !pwdValidation.minLength ? "#ef4444" : "#9ca3af"} />
                <Text className={`text-xs ml-1 ${pwdValidation.minLength ? 'text-emerald-500' : submitted && !pwdValidation.minLength ? 'text-red-500' : 'text-slate-500'}`}>Mínimo 6 caracteres</Text>
              </View>
              <View className="flex-row items-center mb-1">
                <Ionicons name={pwdValidation.hasUpperCase ? "checkmark-circle" : "ellipse-outline"} size={14} color={pwdValidation.hasUpperCase ? "#10b981" : submitted && !pwdValidation.hasUpperCase ? "#ef4444" : "#9ca3af"} />
                <Text className={`text-xs ml-1 ${pwdValidation.hasUpperCase ? 'text-emerald-500' : submitted && !pwdValidation.hasUpperCase ? 'text-red-500' : 'text-slate-500'}`}>Una letra mayúscula</Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name={pwdValidation.hasNumber ? "checkmark-circle" : "ellipse-outline"} size={14} color={pwdValidation.hasNumber ? "#10b981" : submitted && !pwdValidation.hasNumber ? "#ef4444" : "#9ca3af"} />
                <Text className={`text-xs ml-1 ${pwdValidation.hasNumber ? 'text-emerald-500' : submitted && !pwdValidation.hasNumber ? 'text-red-500' : 'text-slate-500'}`}>Un número</Text>
              </View>
            </View>

            <TouchableOpacity 
              className="w-full bg-green-500 rounded-xl p-4 mt-6 items-center" style={{ minHeight: 48 }}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text className="text-white font-semibold text-lg">Registrarse</Text>
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

            <TouchableOpacity 
              className="w-full p-4 mt-4 items-center"
              onPress={() => router.back()}
              disabled={loading}
            >
              <Text className="text-slate-600 dark:text-slate-400 font-medium">Volver a Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchWrapper>
    </KeyboardAvoidingView>
  );
}
