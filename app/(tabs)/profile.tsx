import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { PendingReviewsAlert } from '@/components/PendingReviewsAlert';
import { decode } from 'base64-arraybuffer';
import { ProfileStats } from '@/components/ProfileStats';
import { calculateAge, isSafeUrl } from '@/lib/utils';

const POSITIONS = ['portero', 'defensa', 'mediocentro', 'delantero'];

const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
    onOk?.();
  } else {
    Alert.alert(title, message, [{ text: 'Aceptar', onPress: onOk }]);
  }
};

export default function ProfileScreen() {
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [isEditing, setIsEditing] = useState(false);

  // Campos de perfil
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preferredPosition, setPreferredPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [saving, setSaving] = useState(false);

  // Campos de cuenta
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Avatar
  const [uploading, setUploading] = useState(false);

  const fetchPhone = async () => {
    if (!user) return;
    setLoadingPhone(true);
    const { data, error } = await supabase
      .from('user_private_data')
      .select('phone')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      if (__DEV__) console.error('fetchPhone error:', error.message);
    } else {
      setPhone(data?.phone || '');
    }
    setLoadingPhone(false);
  };

  React.useEffect(() => {
    fetchPhone();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  React.useEffect(() => {
    return () => {
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    };
  }, []);

  if (!profile || !user) {
    return (
      <View className="flex-1 bg-white dark:bg-neutral-950 justify-center items-center">
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  const checkUsername = (val: string) => {
    setUsername(val);
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);

    if (val.length < 3) {
      setUsernameError(val.length > 0 ? 'Mínimo 3 caracteres' : '');
      setUsernameChecking(false);
      return;
    }

    if (val.toLowerCase() === profile.username?.toLowerCase()) {
      setUsernameError('');
      setUsernameChecking(false);
      return;
    }

    setUsernameError('');
    setUsernameChecking(true);
    const normalized = val.toLowerCase();
    usernameDebounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('username', normalized)
        .neq('id', user.id)
        .maybeSingle();
      setUsernameError(data ? 'El usuario ya está en uso' : '');
      setUsernameChecking(false);
    }, 400);
  };

  const startEditing = () => {
    setFullName(profile.full_name || '');
    setUsername(profile.username || '');
    setUsernameError('');
    setUsernameChecking(false);
    setPreferredPosition(profile.preferred_position || '');
    setNewEmail('');
    setNewPassword('');
    setIsEditing(true);
  };

  const cancelEditing = () => {
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    setUsernameError('');
    setUsernameChecking(false);
    setIsEditing(false);
  };

  // ── Avatar ──────────────────────────────────────────────────────────────
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      await uploadAvatar(result.assets[0].base64, result.assets[0].uri);
    }
  };

  const uploadAvatar = async (base64String: string, uri: string) => {
    setUploading(true);
    try {
      const fileExt = uri.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('avatars').upload(
        fileName, decode(base64String),
        { cacheControl: '3600', upsert: true, contentType: 'image/jpeg' },
      );
      if (error) throw error;
      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('users').update({ avatar_url: publicData.publicUrl }).eq('id', user.id);
      await refreshProfile();
      showAlert('Éxito', 'Foto de perfil actualizada');
    } catch (error) {
      showAlert('Error', error instanceof Error ? error.message : String(error));
    } finally {
      setUploading(false);
    }
  };

  // ── Guardar perfil ──────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!username.trim()) {
      showAlert('Error', 'El nombre de usuario no puede estar vacío');
      return;
    }
    if (usernameError) {
      showAlert('Error', 'Corrige el nombre de usuario antes de guardar');
      return;
    }
    if (usernameChecking) {
      showAlert('Error', 'Espera a que se valide el nombre de usuario');
      return;
    }
    setSaving(true);
    try {
      const [usersResult, phoneResult] = await Promise.all([
        supabase
          .from('users')
          .update({
            full_name: fullName,
            username: username.toLowerCase().trim(),
            preferred_position: preferredPosition || null,
          })
          .eq('id', user.id),
        supabase
          .from('user_private_data')
          .upsert({ user_id: user.id, phone, updated_at: new Date().toISOString() }),
      ]);

      if (usersResult.error) throw usersResult.error;
      if (phoneResult.error) throw phoneResult.error;

      await refreshProfile();
      setIsEditing(false);
      showAlert('Guardado', 'Perfil actualizado correctamente');
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Cambiar email ───────────────────────────────────────────────────────
  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      showAlert('Error', 'Introduce un email válido');
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      showAlert(
        'Confirmación enviada',
        `Te hemos enviado un enlace de confirmación a ${newEmail}. Revisa tu bandeja de entrada y confirma el cambio.`,
      );
      setNewEmail('');
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setSavingEmail(false);
    }
  };

  // ── Cambiar contraseña ──────────────────────────────────────────────────
  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      showAlert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showAlert('Contraseña actualizada', 'Tu contraseña ha sido cambiada correctamente.');
      setNewPassword('');
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : String(e));
    } finally {
      setSavingPassword(false);
    }
  };

  // ── Eliminar cuenta ─────────────────────────────────────────────────────
  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        '⚠️ Eliminar Cuenta\n\nEsta acción es permanente y no se puede deshacer. ¿Estás seguro?',
      );
      if (confirmed) doDeleteAccount();
    } else {
      Alert.alert(
        '⚠️ Eliminar Cuenta',
        'Esta acción es permanente y no se puede deshacer. Se borrarán todos tus datos, partidos y valoraciones.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: doDeleteAccount },
        ],
      );
    }
  };

  const doDeleteAccount = async () => {
    try {
      const { error: profileError } = await supabase.from('users').delete().eq('id', user.id);
      if (profileError) throw profileError;
      const { error: authError } = await supabase.rpc('delete_own_account');
      if (authError && __DEV__) console.warn('delete_own_account RPC no disponible:', authError.message);
      await signOut();
    } catch (e) {
      showAlert('Error', e instanceof Error ? e.message : String(e));
    }
  };

  const age = calculateAge(profile.birthday);

  // ════════════════════════════════════════════════════════════════════════
  // VISTA: perfil
  // ════════════════════════════════════════════════════════════════════════
  if (!isEditing) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-neutral-950" edges={['top']}>
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        >
          <PendingReviewsAlert />

          <View className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800 items-center mt-2">
            {/* Avatar */}
            <View className="relative mb-3">
              {isSafeUrl(profile.avatar_url) ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  className="w-28 h-28 rounded-full border-4 border-green-100 dark:border-gray-800"
                />
              ) : (
                <View className="w-28 h-28 rounded-full bg-green-100 dark:bg-green-900 justify-center items-center border-4 border-white dark:border-gray-900">
                  <Text className="text-4xl text-green-600 dark:text-green-300 font-bold uppercase">
                    {profile.full_name?.charAt(0) || '?'}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                className="absolute bottom-0 right-0 bg-green-500 w-9 h-9 rounded-full items-center justify-center border-2 border-white dark:border-gray-900"
                onPress={pickImage}
                disabled={uploading}
              >
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="camera" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>

            <Text className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
              {profile.full_name}
            </Text>
            <Text className="text-slate-500 dark:text-slate-400 mb-1">@{profile.username}</Text>
            <Text className="text-slate-400 dark:text-slate-500 text-xs mb-4">{user.email}</Text>

            <View className="flex-row gap-2 mb-6 flex-wrap justify-center">
              {age !== null && (
                <View className="bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-full border border-blue-200 dark:border-blue-800">
                  <Text className="text-blue-700 dark:text-blue-300 font-medium">{age} años</Text>
                </View>
              )}
              {profile.preferred_position && (
                <View className="bg-green-50 dark:bg-green-900/30 px-4 py-2 rounded-full border border-green-200 dark:border-green-800">
                  <Text className="text-green-700 dark:text-green-300 font-medium capitalize">
                    {profile.preferred_position}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              className="px-8 py-2.5 bg-slate-100 dark:bg-slate-700 rounded-full"
              onPress={startEditing}
              disabled={loadingPhone}
            >
              {loadingPhone
                ? <ActivityIndicator size="small" color="#64748b" />
                : <Text className="text-slate-800 dark:text-slate-200 font-medium">Editar perfil</Text>}
            </TouchableOpacity>
          </View>

          <View className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 mt-4">
            <ProfileStats profile={profile} />
          </View>

          <TouchableOpacity
            className="w-full border border-slate-200 dark:border-gray-800 rounded-2xl p-4 items-center mt-4 mb-2"
            onPress={signOut}
          >
            <Text className="text-slate-500 dark:text-slate-400 font-semibold">Cerrar sesión</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // VISTA: editar perfil
  // ════════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-neutral-950" edges={['top']}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cabecera */}
        <View className="flex-row items-center justify-between py-4 mb-2">
          <TouchableOpacity onPress={cancelEditing} className="flex-row items-center gap-1">
            <Ionicons name="chevron-back" size={22} color="#64748b" />
            <Text className="text-slate-500 dark:text-slate-400 font-medium">Cancelar</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-slate-900 dark:text-white">Editar perfil</Text>
          <View style={{ width: 80 }} />
        </View>

        {/* ── Avatar ──────────────────────────────────────────────────── */}
        <View className="items-center mb-6">
          <View className="relative">
            {isSafeUrl(profile.avatar_url) ? (
              <Image
                source={{ uri: profile.avatar_url }}
                className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-800"
              />
            ) : (
              <View className="w-24 h-24 rounded-full bg-green-100 dark:bg-green-900 justify-center items-center border-4 border-white dark:border-gray-800">
                <Text className="text-4xl text-green-600 dark:text-green-300 font-bold uppercase">
                  {profile.full_name?.charAt(0) || '?'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              className="absolute bottom-0 right-0 bg-green-500 w-9 h-9 rounded-full items-center justify-center border-2 border-white dark:border-gray-800"
              onPress={pickImage}
              disabled={uploading}
            >
              {uploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="camera" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sección: Información ─────────────────────────────────────── */}
        <View className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-4">
          <Text className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
            Información
          </Text>

          {/* Nombre completo */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Nombre completo
            </Text>
            <TextInput
              className="bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-base"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Tu nombre"
              placeholderTextColor="#9ca3af"
            />
          </View>

          {/* Nombre de usuario */}
          <View className="mb-4">
            <Text className={`text-xs font-semibold mb-1.5 ${usernameError ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
              Nombre de usuario
            </Text>
            <View className="relative justify-center">
              <TextInput
                className={`bg-slate-100 dark:bg-gray-800 border rounded-xl px-4 py-3 pr-10 text-slate-900 dark:text-white text-base ${usernameError ? 'border-red-500' : 'border-slate-200 dark:border-gray-700'}`}
                value={username}
                onChangeText={checkUsername}
                placeholder="usuario"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
              />
              <View className="absolute right-3">
                {usernameChecking && <ActivityIndicator size="small" color="#64748b" />}
                {!usernameChecking && username.length >= 3 && !usernameError && (
                  <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                )}
                {!usernameChecking && usernameError !== '' && (
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                )}
              </View>
            </View>
            {!!usernameError && (
              <Text className="text-red-500 text-xs mt-1">{usernameError}</Text>
            )}
          </View>

          {/* Teléfono */}
          <View className="mb-4">
            <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Teléfono <Text className="text-slate-400 dark:text-slate-500 font-normal">(privado)</Text>
            </Text>
            {loadingPhone ? (
              <View className="bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-4 py-3">
                <ActivityIndicator size="small" color="#64748b" />
              </View>
            ) : (
              <TextInput
                className="bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-base"
                value={phone}
                onChangeText={(v) => setPhone(v.replace(/[^0-9+\s]/g, ''))}
                keyboardType="phone-pad"
                placeholder="Ej: 600 123 456"
                placeholderTextColor="#9ca3af"
              />
            )}
          </View>

          {/* Posición */}
          <View>
            <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Posición principal
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {POSITIONS.map((pos) => (
                <TouchableOpacity
                  key={pos}
                  onPress={() => setPreferredPosition(pos === preferredPosition ? '' : pos)}
                  className={`px-4 py-2 rounded-full border ${
                    preferredPosition === pos
                      ? 'bg-green-500 border-green-500'
                      : 'bg-slate-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <Text className={`capitalize text-sm font-medium ${
                    preferredPosition === pos ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {pos}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Botón guardar perfil */}
        <TouchableOpacity
          className={`rounded-2xl p-4 items-center mb-6 ${saving || loadingPhone || usernameChecking || !!usernameError ? 'bg-green-300 dark:bg-green-800' : 'bg-green-500'}`}
          onPress={handleSaveProfile}
          disabled={saving || loadingPhone || usernameChecking || !!usernameError}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text className="text-white font-bold text-base">Guardar cambios</Text>}
        </TouchableOpacity>

        {/* ── Sección: Cuenta ──────────────────────────────────────────── */}
        <View className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-4">
          <Text className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
            Cuenta
          </Text>

          {/* Email */}
          <View className="mb-5">
            <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Email
            </Text>
            <View className="bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-4 py-3 mb-2">
              <Text className="text-slate-500 dark:text-slate-400">{user.email}</Text>
            </View>
            <Text className="text-xs text-slate-400 dark:text-slate-500 mb-2">
              Nuevo email — recibirás un enlace de confirmación
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white text-base"
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="nuevo@email.com"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity
                className={`px-4 py-3 rounded-xl items-center justify-center ${newEmail.trim() ? 'bg-green-500' : 'bg-slate-200 dark:bg-gray-700'}`}
                onPress={handleUpdateEmail}
                disabled={savingEmail || !newEmail.trim()}
              >
                {savingEmail
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text className={`font-semibold ${newEmail.trim() ? 'text-white' : 'text-slate-400'}`}>
                      Cambiar
                    </Text>}
              </TouchableOpacity>
            </View>
          </View>

          {/* Contraseña */}
          <View>
            <Text className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Nueva contraseña
            </Text>
            <View className="flex-row gap-2">
              <View className="flex-1 flex-row items-center bg-slate-100 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl">
                <TextInput
                  className="flex-1 px-4 py-3 text-slate-900 dark:text-white text-base"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity className="px-3" onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#9ca3af"
                  />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                className={`px-4 py-3 rounded-xl items-center justify-center ${newPassword.length >= 6 ? 'bg-green-500' : 'bg-slate-200 dark:bg-gray-700'}`}
                onPress={handleUpdatePassword}
                disabled={savingPassword || newPassword.length < 6}
              >
                {savingPassword
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text className={`font-semibold ${newPassword.length >= 6 ? 'text-white' : 'text-slate-400'}`}>
                      Cambiar
                    </Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Zona de peligro ──────────────────────────────────────────── */}
        <View className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-2">
          <Text className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">
            Zona de peligro
          </Text>
          <TouchableOpacity
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3.5 items-center"
            onPress={handleDeleteAccount}
          >
            <Text className="text-red-600 dark:text-red-400 font-semibold">
              Eliminar mi cuenta permanentemente
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
