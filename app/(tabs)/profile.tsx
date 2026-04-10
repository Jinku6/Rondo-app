import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { PendingReviewsAlert } from '@/components/PendingReviewsAlert';
import { decode } from 'base64-arraybuffer';
import { ProfileStats } from '@/components/ProfileStats';

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
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [preferredPosition, setPreferredPosition] = useState(profile?.preferred_position || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Campos de cuenta
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showAccountSection, setShowAccountSection] = useState(false);

  if (!profile || !user) return <View className="flex-1 bg-white dark:bg-neutral-950 justify-center items-center"><ActivityIndicator size="large" color="#22C55E" /></View>;

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      if (result.assets[0].base64) {
        await uploadAvatar(result.assets[0].base64, result.assets[0].uri);
      } else {
        showAlert('Error', 'No se generó el buffer de imagen.');
      }
    }
  };

  const uploadAvatar = async (base64String: string, uri: string) => {
    setUploading(true);
    try {
      const fileExt = uri.split('.').pop()?.split('?')[0] || 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error } = await supabase.storage.from('avatars').upload(fileName, decode(base64String), {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/jpeg'
      });

      if (error) throw error;

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      
      await supabase.from('users').update({ avatar_url: publicData.publicUrl }).eq('id', user.id);
      await refreshProfile();

      showAlert('Éxito', 'Foto de perfil actualizada');
    } catch (error: any) {
      console.error('Upload error:', error);
      showAlert('Error al subir imagen', error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          full_name: fullName,
          username: username.toLowerCase(),
          preferred_position: preferredPosition || null,
        })
        .eq('id', user.id);

      if (error) throw error;
      
      await refreshProfile();
      setIsEditing(false);
      showAlert('Guardado', 'Perfil actualizado correctamente');
    } catch (e: any) {
      showAlert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) return;
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      showAlert('Email actualizado', 'Te hemos enviado un enlace de confirmación al nuevo email.');
      setNewEmail('');
    } catch (e: any) {
      showAlert('Error', e.message);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      showAlert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showAlert('Contraseña actualizada', 'Tu contraseña ha sido cambiada correctamente.');
      setNewPassword('');
    } catch (e: any) {
      showAlert('Error', e.message);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ Eliminar Cuenta',
      'Esta acción es permanente y no se puede deshacer. Se borrarán todos tus datos, partidos y valoraciones. ¿Estás seguro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete user profile (cascade will handle related data)
              await supabase.from('users').delete().eq('id', user.id);
              await signOut();
            } catch (e: any) {
              showAlert('Error', e.message);
            }
          }
        }
      ]
    );
  };

  const startEditing = () => {
    setFullName(profile.full_name || '');
    setUsername(profile.username || '');
    setPreferredPosition(profile.preferred_position || '');
    setIsEditing(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-neutral-950" edges={['top']}>
      <ScrollView className="flex-1 bg-slate-50 dark:bg-neutral-950 p-6" contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Alerta de valoraciones pendientes */}
      <PendingReviewsAlert />

      <View className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800 items-center">
        
        {/* Avatar */}
        <View className="relative">
          {profile.avatar_url ? (
            <Image 
              source={{ uri: profile.avatar_url }} 
              className="w-28 h-28 rounded-full mb-4 border-4 border-green-100 dark:border-gray-800" 
            />
          ) : (
            <View className="w-28 h-28 rounded-full bg-green-100 dark:bg-green-900 justify-center items-center mb-4 border-4 border-white dark:border-gray-900">
              <Text className="text-4xl text-green-600 dark:text-green-300 font-bold uppercase">
                {profile.full_name?.charAt(0) || '?'}
              </Text>
            </View>
          )}
          <TouchableOpacity 
            className="absolute bottom-4 right-0 bg-green-500 w-10 h-10 rounded-full items-center justify-center border-2 border-white dark:border-gray-900"
            onPress={pickImage}
            disabled={uploading}
          >
            {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={20} color="#fff" />}
          </TouchableOpacity>
        </View>

        {/* Info / Edit */}
        {!isEditing ? (
          <>
            <Text className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{profile.full_name}</Text>
            <Text className="text-slate-500 dark:text-slate-400 mb-2">@{profile.username}</Text>
            <Text className="text-slate-400 dark:text-slate-500 text-xs mb-4">{user.email}</Text>

            {profile.preferred_position && (
              <View className="bg-green-50 dark:bg-green-900/30 px-4 py-2 rounded-full mb-6 border border-green-200 dark:border-green-800">
                <Text className="text-green-700 dark:text-green-300 font-medium capitalize">
                  {profile.preferred_position}
                </Text>
              </View>
            )}

            <TouchableOpacity 
              className="px-6 py-2 bg-slate-100 dark:bg-slate-700 rounded-full"
              onPress={startEditing}
            >
              <Text className="text-slate-800 dark:text-slate-200 font-medium">Editar Perfil</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View className="w-full space-y-4 mb-4">
            <View>
              <Text className="text-slate-500 text-xs mb-1">Nombre Completo</Text>
              <TextInput 
                className="w-full bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-3 text-slate-900 dark:text-white"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
            <View>
              <Text className="text-slate-500 text-xs mb-1">Usuario</Text>
              <TextInput 
                className="w-full bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-3 text-slate-900 dark:text-white"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
            <View>
              <Text className="text-slate-500 text-xs mb-1">Posición Principal</Text>
              <View className="flex-row flex-wrap gap-2">
                {POSITIONS.map(pos => (
                  <TouchableOpacity 
                    key={pos} 
                    onPress={() => setPreferredPosition(pos)} 
                    className={`px-3 py-2 rounded-full border ${preferredPosition === pos ? 'bg-green-500 border-green-500' : 'bg-slate-100 dark:bg-gray-900 border-gray-200 dark:border-gray-800'}`}>
                    <Text className={`capitalize text-sm font-medium ${preferredPosition === pos ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>{pos}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View className="flex-row space-x-3 mt-4">
              <TouchableOpacity className="flex-1 bg-slate-200 dark:bg-gray-800 p-3 rounded-xl items-center mr-2" onPress={() => setIsEditing(false)}>
                <Text className="text-slate-700 dark:text-slate-300 font-medium">Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 bg-green-500 p-3 rounded-xl items-center ml-2" onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-medium">Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Stats */}
        <ProfileStats profile={profile} />
      </View>

      {/* Account Settings */}
      <TouchableOpacity 
        className="w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mt-6 flex-row justify-between items-center"
        onPress={() => setShowAccountSection(!showAccountSection)}
      >
        <View className="flex-row items-center">
          <Ionicons name="settings-outline" size={20} color="#64748b" />
          <Text className="text-slate-700 dark:text-slate-300 font-medium ml-3">Ajustes de Cuenta</Text>
        </View>
        <Ionicons name={showAccountSection ? "chevron-up" : "chevron-down"} size={20} color="#64748b" />
      </TouchableOpacity>

      {showAccountSection && (
        <View className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mt-2 space-y-5">
          {/* Cambiar Email */}
          <View>
            <Text className="text-slate-600 dark:text-slate-400 font-medium mb-2">Cambiar Email</Text>
            <Text className="text-slate-400 text-xs mb-2">Email actual: {user.email}</Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-3 text-slate-900 dark:text-white mr-2"
                placeholder="nuevo@email.com"
                placeholderTextColor="#9ca3af"
                value={newEmail}
                onChangeText={setNewEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity className="bg-green-500 px-4 py-3 rounded-xl" onPress={handleUpdateEmail}>
                <Text className="text-white font-medium">Cambiar</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Cambiar Contraseña */}
          <View>
            <Text className="text-slate-600 dark:text-slate-400 font-medium mb-2">Cambiar Contraseña</Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-lg p-3 text-slate-900 dark:text-white mr-2"
                placeholder="Nueva contraseña"
                placeholderTextColor="#9ca3af"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <TouchableOpacity className="bg-green-500 px-4 py-3 rounded-xl" onPress={handleUpdatePassword}>
                <Text className="text-white font-medium">Cambiar</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Eliminar cuenta */}
          <TouchableOpacity 
            className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 items-center mt-2"
            onPress={handleDeleteAccount}
          >
            <Text className="text-red-600 dark:text-red-400 font-medium">Eliminar mi cuenta permanentemente</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity 
        className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl p-4 mt-6 items-center mb-8"
        onPress={signOut}
      >
        <Text className="text-red-600 dark:text-red-400 font-bold text-lg">Cerrar Sesión</Text>
      </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
