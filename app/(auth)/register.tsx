import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback,
  ActivityIndicator, Alert, ScrollView, Platform, KeyboardAvoidingView,
  Keyboard, Image, Modal,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { z } from 'zod';
import { Colors } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ConfirmHcaptcha from '@hcaptcha/react-native-hcaptcha';
import { AppleSignInButton } from '@/components/auth/AppleSignInButton';
import { useTheme } from '@/hooks/use-theme';

const MIN_PASSWORD_LENGTH = 6;

const RegisterSchema = z.object({
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  username: z.string().min(3, 'El nombre de usuario debe tener mínimo 3 caracteres'),
  preferredPosition: z.string().min(1, 'Debes seleccionar una posición'),
  email: z.string().email('El correo electrónico no es válido'),
  password: z.string()
    .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener mínimo ${MIN_PASSWORD_LENGTH} caracteres`)
    .regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula')
    .regex(/\d/, 'La contraseña debe incluir al menos un número'),
  phone: z.string()
    .min(9, 'El teléfono debe tener al menos 9 dígitos')
    .regex(/^\d+$/, 'El teléfono solo puede contener números'),
  birthday: z.string().min(1, 'La fecha de nacimiento es obligatoria'),
});

const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
    onOk?.();
  } else {
    Alert.alert(title, message, [{ text: 'Aceptar', onPress: onOk }]);
  }
};

type HcaptchaMessageEvent = {
  nativeEvent?: { data?: string };
  success?: boolean;
  markUsed?: () => void;
};

const POSITIONS = [
  { key: 'portero',     label: 'Portero',   emoji: '🧤' },
  { key: 'defensa',     label: 'Defensa',   emoji: '🛡️' },
  { key: 'mediocentro', label: 'Medio',     emoji: '⚙️' },
  { key: 'delantero',   label: 'Delantero', emoji: '⚡' },
];

const c = Colors;
const MIN_BIRTHDAY_DATE = new Date(1900, 0, 1);

const inp = {
  backgroundColor: 'rgba(255,255,255,0.04)' as const,
  borderColor: 'rgba(255,255,255,0.08)' as const,
  borderWidth: 1,
  borderRadius: 14,
  paddingHorizontal: 16,
  paddingVertical: 14,
  color: c.text,
  fontSize: 15,
};

const inpError = { ...inp, borderColor: c.danger as string };

const lbl = {
  fontSize: 11,
  fontWeight: '600' as const,
  color: c.textDim,
  marginBottom: 6,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
};

export default function RegisterScreen() {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [preferredPosition, setPreferredPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captchaRef = useRef<ConfirmHcaptcha | null>(null);
  const captchaSiteKey = process.env.EXPO_PUBLIC_HCAPTCHA_SITE_KEY;

  const { signUp, resendSignUpConfirmation, signInWithGoogle } = useAuth();
  const router = useRouter();

  const checkUsername = (val: string) => {
    setUsername(val);
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    if (val.length < 3) {
      setUsernameError(val.length > 0 ? 'Mínimo 3 caracteres' : '');
      setUsernameChecking(false);
      return;
    }
    setUsernameChecking(true);
    usernameDebounceRef.current = setTimeout(async () => {
      const { data } = await supabase.from('users').select('id').eq('username', val.toLowerCase()).maybeSingle();
      setUsernameError(data ? 'El usuario ya está en uso' : '');
      setUsernameChecking(false);
    }, 400);
  };

  const validatePassword = (pwd: string) => ({
    minLength: pwd.length >= MIN_PASSWORD_LENGTH,
    hasUpperCase: /[A-Z]/.test(pwd),
    hasNumber: /\d/.test(pwd),
  });

  const isFieldError = (value: string) => submitted && !value.trim();

  const validateForm = useCallback(() => {
    setSubmitted(true);
    const birthdayIso = birthday ? birthday.toISOString().split('T')[0] : '';
    try {
      RegisterSchema.parse({ fullName, username, preferredPosition, email, password, phone, birthday: birthdayIso });
    } catch (err) {
      if (err instanceof z.ZodError) {
        showAlert('Error de validación', err.issues[0].message);
        return false;
      }
    }
    if (usernameError) {
      showAlert('Error', 'Corrige el nombre de usuario');
      return false;
    }
    return true;
  }, [birthday, fullName, username, preferredPosition, email, password, phone, usernameError]);

  const doRegister = useCallback(async (captchaToken: string) => {
    setLoading(true);
    try {
    const birthdayIso = birthday ? birthday.toISOString().split('T')[0] : '';
    const normalizedEmail = email.trim().toLowerCase();
    const emailExists = false;
    if (emailExists) {
      const { error } = await resendSignUpConfirmation(normalizedEmail, captchaToken);
      setLoading(false);
      if (error) {
        if (__DEV__) console.error('Error reenviando confirmación:', error);
        showAlert('Error de confirmación', error);
        return;
      }
      showAlert(
        'Confirmación reenviada',
        'Si tu cuenta sigue pendiente de confirmar, te hemos enviado otro email. Revisa también spam o promociones.',
        () => router.replace('/(auth)/login'),
      );
      return;
    }
    const { error } = await signUp(normalizedEmail, password, username.toLowerCase(), fullName, preferredPosition, phone, birthdayIso, captchaToken);
    setLoading(false);
    if (error) {
      if (__DEV__) console.error('Error de registro:', error);
      showAlert('Error de registro', error);
    } else {
      showAlert(
        '¡Registro exitoso!',
        'Te hemos enviado un email de confirmación. Revisa tu bandeja de entrada y confirma tu cuenta antes de iniciar sesión.',
        () => router.replace('/(auth)/login'),
      );
    }
    } catch (error) {
      setLoading(false);
      const message = error instanceof Error ? error.message : 'No se pudo completar el registro.';
      if (__DEV__) console.error('Error de registro:', message);
      showAlert('Error de registro', message);
    }
  }, [birthday, email, password, username, fullName, preferredPosition, phone, signUp, resendSignUpConfirmation, router]);

  const handleCaptchaMessage = useCallback(async (event: HcaptchaMessageEvent) => {
    const token = event.nativeEvent?.data;

    if (event.success && token) {
      event.markUsed?.();
      captchaRef.current?.hide('verified');
      await doRegister(token);
      return;
    }

    if (token === 'open') return;

    captchaRef.current?.hide('handled');
    setLoading(false);
    if (token && token !== 'cancel' && token !== 'challenge-closed') {
      showAlert('Captcha', 'No se pudo verificar la solicitud. Inténtalo de nuevo.');
    }
  }, [doRegister]);

  function handleRegister() {
    if (!validateForm()) return;
    if (!captchaSiteKey || !captchaRef.current) {
      showAlert('Captcha', 'No se pudo iniciar la verificación. Inténtalo de nuevo.');
      return;
    }
    setLoading(true);
    captchaRef.current.show();
  }

  const pwdValidation = validatePassword(password);

  const TouchWrapper: any = Platform.OS === 'web' ? View : TouchableWithoutFeedback;
  const touchProps = Platform.OS === 'web'
    ? { style: { flex: 1 } }
    : { onPress: Keyboard.dismiss, accessible: false, style: { flex: 1 } };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <TouchWrapper {...touchProps}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: insets.top + 16, paddingHorizontal: 24, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <Image
              source={require('@/assets/images/rondo-icon.png')}
              style={{ width: 64, height: 64, marginBottom: 16 }}
              resizeMode="contain"
            />
            <Text style={{ fontSize: 10, fontWeight: '700', color: c.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
              REGISTRO
            </Text>
            <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 28, fontWeight: '900', color: c.brand, letterSpacing: -0.5 }}>
              Únete a Rondo
            </Text>
          </View>

          <View style={{ gap: 16 }}>
            {/* Nombre Completo */}
            <View>
              <Text style={[lbl, isFieldError(fullName) && { color: c.danger }]}>
                Nombre Completo {isFieldError(fullName) ? '*' : ''}
              </Text>
              <TextInput
                style={isFieldError(fullName) ? inpError : inp}
                placeholder="Juan Pérez"
                placeholderTextColor={c.textMuted}
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
            </View>

            {/* Nombre de Usuario */}
            <View>
              <Text style={[lbl, (isFieldError(username) || !!usernameError) && { color: c.danger }]}>
                Nombre de Usuario {isFieldError(username) ? '*' : ''}
              </Text>
              <View style={{ position: 'relative', justifyContent: 'center' }}>
                <TextInput
                  style={isFieldError(username) || !!usernameError ? { ...inpError, paddingRight: 44 } : { ...inp, paddingRight: 44 }}
                  placeholder="juanp"
                  placeholderTextColor={c.textMuted}
                  value={username}
                  onChangeText={checkUsername}
                  autoCapitalize="none"
                />
                <View style={{ position: 'absolute', right: 14 }}>
                  {usernameChecking && <ActivityIndicator size="small" color={c.textDim} />}
                  {!usernameChecking && username.length >= 3 && !usernameError && <Ionicons name="checkmark-circle" size={20} color={c.brand} />}
                  {!usernameChecking && usernameError !== '' && <Ionicons name="close-circle" size={20} color={c.danger} />}
                </View>
              </View>
              {usernameError !== '' && <Text style={{ color: c.danger, fontSize: 11, marginTop: 4 }}>{usernameError}</Text>}
            </View>

            {/* Posición */}
            <View>
              <Text style={[lbl, submitted && !preferredPosition && { color: c.danger }]}>
                Tu posición {submitted && !preferredPosition ? '*' : ''}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {POSITIONS.map(pos => {
                  const active = preferredPosition === pos.key;
                  return (
                    <TouchableOpacity
                      key={pos.key}
                      onPress={() => setPreferredPosition(pos.key)}
                      style={{
                        flex: 1,
                        minWidth: '45%',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        backgroundColor: active ? c.brandSoft : 'rgba(255,255,255,0.04)',
                        borderColor: active ? c.brand : (submitted && !preferredPosition ? c.danger : 'rgba(255,255,255,0.08)'),
                      }}
                    >
                      <Text style={{ fontSize: 18 }}>{pos.emoji}</Text>
                      <Text style={{ color: active ? c.brand : c.text, fontWeight: '600', fontSize: 13 }}>{pos.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Teléfono */}
            <View>
              <Text style={[lbl, isFieldError(phone) && { color: c.danger }]}>
                Teléfono {isFieldError(phone) ? '*' : ''}
              </Text>
              <TextInput
                style={isFieldError(phone) ? inpError : inp}
                placeholder="600000000"
                placeholderTextColor={c.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="numeric"
              />
              <Text style={{ color: c.textMuted, fontSize: 10, marginTop: 4, fontStyle: 'italic' }}>
                Solo visible para el organizador del partido.
              </Text>
            </View>

            {/* Fecha de Nacimiento */}
            <View>
              <Text style={[lbl, submitted && !birthday && { color: c.danger }]}>
                Fecha de Nacimiento {submitted && !birthday ? '*' : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setShowBirthdayPicker(true)}
                style={{
                  ...inp,
                  borderColor: submitted && !birthday ? c.danger : 'rgba(255,255,255,0.08)',
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="calendar-outline" size={18} color={birthday ? c.brand : c.textMuted} style={{ marginRight: 10 }} />
                <Text style={{ color: birthday ? c.text : c.textMuted, fontSize: 15 }}>
                  {birthday
                    ? birthday.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'Selecciona tu fecha de nacimiento'}
                </Text>
              </TouchableOpacity>

              {Platform.OS === 'android' && showBirthdayPicker && (
                <DateTimePicker
                  value={birthday ?? new Date(2000, 0, 1)}
                  mode="date"
                  display="default"
                  minimumDate={MIN_BIRTHDAY_DATE}
                  maximumDate={new Date(new Date().getFullYear() - 14, 11, 31)}
                  onChange={(_: DateTimePickerEvent, date?: Date) => {
                    setShowBirthdayPicker(false);
                    if (date) setBirthday(date);
                  }}
                />
              )}

              {Platform.OS === 'ios' && (
                <Modal transparent animationType="slide" visible={showBirthdayPicker}>
                  <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' }}>
                    <View style={{ backgroundColor: c.bgElev, paddingBottom: 40, paddingTop: 16, paddingHorizontal: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 12 }}>
                        <TouchableOpacity onPress={() => setShowBirthdayPicker(false)}>
                          <Text style={{ color: c.danger, fontWeight: '600', fontSize: 16 }}>Cancelar</Text>
                        </TouchableOpacity>
                        <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>Fecha de nacimiento</Text>
                        <TouchableOpacity onPress={() => setShowBirthdayPicker(false)}>
                          <Text style={{ color: c.brand, fontWeight: '700', fontSize: 16 }}>Confirmar</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={birthday ?? new Date(2000, 0, 1)}
                        mode="date"
                        display="spinner"
                        minimumDate={MIN_BIRTHDAY_DATE}
                        maximumDate={new Date(new Date().getFullYear() - 14, 11, 31)}
                        onChange={(_: DateTimePickerEvent, date?: Date) => { if (date) setBirthday(date); }}
                      />
                    </View>
                  </View>
                </Modal>
              )}
            </View>

            {/* Email */}
            <View>
              <Text style={[lbl, isFieldError(email) && { color: c.danger }]}>
                Email {isFieldError(email) ? '*' : ''}
              </Text>
              <TextInput
                style={isFieldError(email) ? inpError : inp}
                placeholder="tu@email.com"
                placeholderTextColor={c.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            {/* Contraseña */}
            <View>
              <Text style={[lbl, isFieldError(password) && { color: c.danger }]}>
                Contraseña {isFieldError(password) ? '*' : ''}
              </Text>
              <View style={{ position: 'relative', justifyContent: 'center' }}>
                <TextInput
                  style={isFieldError(password) ? { ...inpError, paddingRight: 44 } : { ...inp, paddingRight: 44 }}
                  placeholder="Introduce tu contraseña"
                  placeholderTextColor={c.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={{ position: 'absolute', right: 14 }} onPress={() => setShowPassword(v => !v)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={c.textDim} />
                </TouchableOpacity>
              </View>
              <View style={{ marginTop: 8, gap: 4 }}>
                {[
                  { ok: pwdValidation.minLength, label: `Mínimo ${MIN_PASSWORD_LENGTH} caracteres` },
                  { ok: pwdValidation.hasUpperCase, label: 'Una letra mayúscula' },
                  { ok: pwdValidation.hasNumber, label: 'Un número' },
                ].map(({ ok, label }) => (
                  <View key={label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons
                      name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                      size={13}
                      color={ok ? c.brand : submitted && !ok ? c.danger : c.textMuted}
                    />
                    <Text style={{ fontSize: 11, marginLeft: 6, color: ok ? c.brand : submitted && !ok ? c.danger : c.textMuted }}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* CTA */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading}
              style={{
                backgroundColor: c.brand,
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: 'center',
                marginTop: 8,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 15, fontWeight: '900', color: '#fff', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  Unirse al equipo
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              <Text style={{ marginHorizontal: 14, color: c.textMuted, fontSize: 12, fontWeight: '600' }}>O</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            </View>

            {/* Google */}
            <TouchableOpacity
              onPress={signInWithGoogle}
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="logo-google" size={20} color="#4285F4" />
              <Text style={{ color: c.text, fontWeight: '600', fontSize: 15, marginLeft: 10 }}>Continuar con Google</Text>
            </TouchableOpacity>

            <AppleSignInButton />

            {/* Back */}
            <TouchableOpacity
              onPress={() => router.back()}
              disabled={loading}
              style={{ paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: c.textDim, fontWeight: '500' }}>Volver a Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchWrapper>
      {captchaSiteKey ? (
        <ConfirmHcaptcha
          ref={captchaRef}
          siteKey={captchaSiteKey}
          baseUrl="https://hcaptcha.com"
          size="invisible"
          onMessage={handleCaptchaMessage}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}
