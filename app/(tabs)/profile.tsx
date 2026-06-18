import React, { useCallback, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, Platform, Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { PendingReviewsAlert } from '@/components/PendingReviewsAlert';
import { decode } from 'base64-arraybuffer';
import { calculateAge, isSafeUrl } from '@/lib/utils';
import { Colors } from '@/constants/theme';
import { FLOATING_TAB_BAR_HEIGHT } from '@/components/rondo/FloatingTabBar';
import { getErrorMessage, logSupabaseError } from '@/lib/supabaseErrors';
import { containsProfanity } from '@/lib/profanityFilter';
import { ScreenTitle } from '@/components/ui/ScreenTitle';
import { useTheme } from '@/hooks/use-theme';
import {
  formatMemberSince,
  getAttitudeEmoji,
  getReliabilityInfo,
  POSITION_EMOJIS,
  POSITION_LABELS,
  POSITIONS,
} from '@/components/profile/profileDisplay';

const c = Colors;

const MIN_PASSWORD_LENGTH = 6;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const showAlert = (title: string, message: string, onOk?: () => void) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}: ${message}`);
    onOk?.();
  } else {
    Alert.alert(title, message, [{ text: 'Aceptar', onPress: onOk }]);
  }
};

const inp = {
  backgroundColor: 'rgba(255,255,255,0.04)' as const,
  borderColor: 'rgba(255,255,255,0.08)' as const,
  borderWidth: 1,
  borderRadius: 14,
  paddingHorizontal: 16,
  paddingVertical: 13,
  color: c.text,
  fontSize: 15,
};

const sectionCard = {
  backgroundColor: c.bgElev,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: c.border,
  padding: 18,
  marginBottom: 14,
};

export default function ProfileScreen() {
  const { colors: c } = useTheme();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [isEditing, setIsEditing] = useState(false);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [preferredPosition, setPreferredPosition] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [initialPhone, setInitialPhone] = useState('');
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [uploading, setUploading] = useState(false);

  const fetchPhone = useCallback(async () => {
    if (!user) return;
    setLoadingPhone(true);
    try {
      const { data, error } = await supabase
        .from('user_private_data').select('phone').eq('user_id', user.id).maybeSingle();
      if (error) throw error;
      const nextPhone = data?.phone || '';
      setPhone(nextPhone);
      setInitialPhone(nextPhone);
    } catch (error) {
      logSupabaseError('profile fetch phone error', error);
    } finally {
      setLoadingPhone(false);
    }
  }, [user]);

  React.useEffect(() => {
    fetchPhone();
  }, [fetchPhone]);

  React.useEffect(() => {
    return () => {
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    };
  }, []);

  if (!profile || !user) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={c.brand} />
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
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id')
          .eq('username', normalized)
          .neq('id', user.id)
          .maybeSingle();
        if (error) throw error;
        setUsernameError(data ? 'El usuario ya está en uso' : '');
      } catch (error) {
        logSupabaseError('profile username check error', error);
        setUsernameError('No se pudo validar el usuario');
      } finally {
        setUsernameChecking(false);
      }
    }, 400);
  };

  const startEditing = () => {
    setFullName(profile.full_name || '');
    setUsername(profile.username || '');
    setUsernameError('');
    setUsernameChecking(false);
    setPreferredPosition(profile.preferred_position || '');
    setBio(profile.bio || '');
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

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5, base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        await uploadAvatar(result.assets[0]);
      }
    } catch (error) {
      logSupabaseError('profile pick image error', error);
      showAlert('Error', getErrorMessage(error, 'No se pudo seleccionar la imagen.'));
    }
  };

  const uploadAvatar = async (asset: ImagePicker.ImagePickerAsset) => {
    setUploading(true);
    try {
      const mimeType = asset.mimeType ?? '';
      const fileExt = AVATAR_MIME_EXTENSIONS[mimeType];

      if (!asset.base64) throw new Error('No se pudo leer la imagen seleccionada.');
      if (!fileExt) throw new Error('Formato no permitido. Usa JPG, PNG o WebP.');
      if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_AVATAR_BYTES) {
        throw new Error('La imagen debe pesar menos de 2 MB.');
      }

      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('avatars').upload(
        fileName, decode(asset.base64), { cacheControl: '3600', upsert: true, contentType: mimeType },
      );
      if (error) throw error;
      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      await supabase.from('users').update({ avatar_url: publicData.publicUrl }).eq('id', user.id);
      await refreshProfile();
      showAlert('Éxito', 'Foto de perfil actualizada');
    } catch (error) {
      logSupabaseError('profile avatar upload error', error);
      showAlert('Error', getErrorMessage(error, 'No se pudo actualizar la foto de perfil.'));
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!username.trim()) { showAlert('Error', 'El nombre de usuario no puede estar vacío'); return; }
    if (usernameError) { showAlert('Error', 'Corrige el nombre de usuario antes de guardar'); return; }
    if (usernameChecking) { showAlert('Error', 'Espera a que se valide el nombre de usuario'); return; }
    if (containsProfanity(bio)) { showAlert('Error', 'La bio contiene vocabulario no permitido.'); return; }
    setSaving(true);
    try {
      const { error: usersError } = await supabase.from('users').update({
        full_name: fullName.trim(),
        username: username.toLowerCase().trim(),
        preferred_position: preferredPosition || null,
        bio: bio.trim() || null,
      }).eq('id', user.id);
      if (usersError) throw usersError;

      const normalizedPhone = phone.trim();
      if (normalizedPhone !== initialPhone.trim()) {
        const { error: phoneError } = await supabase
          .from('user_private_data')
          .upsert(
            { user_id: user.id, phone: normalizedPhone, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' },
          );
        if (phoneError) throw phoneError;
        setInitialPhone(normalizedPhone);
      }
      await refreshProfile();
      setIsEditing(false);
      showAlert('Guardado', 'Perfil actualizado correctamente');
    } catch (e) {
      logSupabaseError('profile save error', e);
      showAlert('Error', getErrorMessage(e, 'No se pudo guardar el perfil.'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) { showAlert('Error', 'Introduce un email válido'); return; }
    setSavingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      showAlert('Confirmación enviada', `Te hemos enviado un enlace de confirmación a ${newEmail}.`);
      setNewEmail('');
    } catch (e) {
      logSupabaseError('profile email update error', e);
      showAlert('Error', getErrorMessage(e, 'No se pudo actualizar el email.'));
    } finally {
      setSavingEmail(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < MIN_PASSWORD_LENGTH) { showAlert('Error', `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`); return; }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      showAlert('Contraseña actualizada', 'Tu contraseña ha sido cambiada correctamente.');
      setNewPassword('');
    } catch (e) {
      logSupabaseError('profile password update error', e);
      showAlert('Error', getErrorMessage(e, 'No se pudo actualizar la contrasena.'));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('⚠️ Eliminar Cuenta\n\nEsta acción es permanente. ¿Estás seguro?');
      if (confirmed) doDeleteAccount();
    } else {
      Alert.alert('⚠️ Eliminar Cuenta', 'Esta acción es permanente y no se puede deshacer.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: doDeleteAccount },
      ]);
    }
  };

  const doDeleteAccount = async () => {
    try {
      const { error: brevoError } = await supabase.functions.invoke('delete-brevo-contact');
      if (brevoError && __DEV__) console.warn('delete-brevo-contact no bloqueante:', brevoError.message);

      const { error: profileError } = await supabase.from('users').delete().eq('id', user.id);
      if (profileError) throw profileError;
      const { error: authError } = await supabase.rpc('delete_own_account');
      if (authError && __DEV__) console.warn('delete_own_account RPC no disponible:', authError.message);
      await signOut();
    } catch (e) {
      logSupabaseError('profile delete account error', e);
      showAlert('Error', getErrorMessage(e, 'No se pudo eliminar la cuenta.'));
    }
  };

  const age = calculateAge(profile.birthday);

  // ── View mode ────────────────────────────────────────────────────────────
  if (!isEditing) {
    const reliability = getReliabilityInfo(profile.reliability_score);

    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: insets.top + 16,
            paddingBottom: FLOATING_TAB_BAR_HEIGHT + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={{ fontSize: 12, color: c.textDim, letterSpacing: 2.4, textTransform: 'uppercase', marginBottom: 4 }}>
            Perfil
          </Text>
          <View style={{ marginBottom: 20 }}>
            <ScreenTitle>
              Mi Perfil
            </ScreenTitle>
          </View>
          {/* ── Identity ───────────────────────────────────────────── */}
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <View style={{ position: 'relative' }}>
              {isSafeUrl(profile.avatar_url) ? (
                <Image
                  source={{ uri: profile.avatar_url! }}
                  style={{
                    width: 132,
                    height: 132,
                    borderRadius: 66,
                    borderWidth: 3,
                    borderColor: c.brand,
                    marginBottom: 16,
                  }}
                />
              ) : (
                <View style={{
                  width: 132,
                  height: 132,
                  borderRadius: 66,
                  backgroundColor: c.brandSoft,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 3,
                  borderColor: c.brand,
                  marginBottom: 16,
                }}>
                  <Text style={{ fontSize: 52, color: c.brand, fontWeight: '800' }}>
                    {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={{
                  position: 'absolute', bottom: 16, right: 0,
                  backgroundColor: c.brand, width: 38, height: 38,
                  borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                  borderWidth: 2, borderColor: c.bgElev
                }}
                onPress={pickImage}
                disabled={uploading}
              >
                {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={18} color="#fff" />}
              </TouchableOpacity>
            </View>

            <Text style={{
              fontFamily: 'Archivo_900Black',
              fontSize: 34,
              fontWeight: '900',
              color: c.text,
              letterSpacing: -0.4,
              marginBottom: 4,
              textAlign: 'center',
            }}>
              {profile.full_name}
            </Text>

            <Text style={{ fontSize: 14, color: c.textDim, marginBottom: 4 }}>
              @{profile.username}
            </Text>

            <Text style={{ fontSize: 12, color: c.textMuted }}>
              Jugador desde {formatMemberSince(profile.created_at)}
            </Text>
          </View>

          {/* ── Quick Stats Row ────────────────────────────────────── */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: c.bgElev,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: c.border,
            marginBottom: 14,
            overflow: 'hidden',
          }}>
            {/* Años */}
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                Edad
              </Text>
              <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 22, fontWeight: '900', color: c.text }}>
                {age !== null ? age : '—'}
              </Text>
            </View>

            {/* Divider */}
            <View style={{ width: 1, backgroundColor: c.border, marginVertical: 14 }} />

            {/* Posición */}
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                Posición
              </Text>
              <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 15, fontWeight: '900', color: c.text, textAlign: 'center' }}>
                {profile.preferred_position
                  ? POSITION_LABELS[profile.preferred_position] ?? profile.preferred_position
                  : '—'}
              </Text>
            </View>

            {/* Divider */}
            <View style={{ width: 1, backgroundColor: c.border, marginVertical: 14 }} />

            {/* Fiabilidad */}
            <View style={{ flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: c.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
                Fiabilidad
              </Text>
              {profile.matches_played >= 3 ? (
                <>
                  <Text style={{ fontSize: 18, marginBottom: 2 }}>{reliability.icon}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: reliability.color, textAlign: 'center', lineHeight: 14 }}>
                    {reliability.label}
                  </Text>
                </>
              ) : (
                <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 15, fontWeight: '900', color: c.textMuted }}>—</Text>
              )}
            </View>
          </View>

          {/* ── Sobre mí ───────────────────────────────────────────── */}
          <View style={{
            backgroundColor: c.bgElev,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: c.border,
            padding: 18,
            marginBottom: 14,
          }}>
            <Text style={{
              fontSize: 10,
              fontWeight: '700',
              color: c.textDim,
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 10,
            }}>
              Sobre mí
            </Text>
            <Text style={{ fontSize: 14, color: profile.bio ? c.textDim : c.textMuted, lineHeight: 22, fontStyle: profile.bio ? 'normal' : 'italic' }}>
              {profile.bio ?? 'Sin descripción todavía.'}
            </Text>
          </View>

          {/* ── Estadísticas ───────────────────────────────────────── */}
          <Text style={{
            fontSize: 10,
            fontWeight: '700',
            color: c.textDim,
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 10,
          }}>
            Estadísticas
          </Text>

          {profile.matches_played < 3 ? (
            <View style={{
              backgroundColor: c.brandSoft,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: c.brand + '33',
              padding: 20,
              alignItems: 'center',
              marginBottom: 14,
            }}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🌱</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: c.brand, marginBottom: 4 }}>Jugador en crecimiento</Text>
              <Text style={{ fontSize: 13, color: c.textDim, textAlign: 'center', lineHeight: 20 }}>
                Las estadísticas se desbloquean al completar 3 partidos valorados ({profile.matches_played}/3).
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
              {/* Partidos */}
              <View style={{
                flex: 1,
                backgroundColor: c.bgElev,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.border,
                padding: 16,
                alignItems: 'center',
              }}>
                <Ionicons name="football-outline" size={22} color={c.textMuted} style={{ marginBottom: 8 }} />
                <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 26, fontWeight: '900', color: c.text, marginBottom: 2 }}>
                  {profile.matches_played}
                </Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: c.textMuted, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                  Partidos
                </Text>
              </View>

              {/* Actitud */}
              <View style={{
                flex: 1,
                backgroundColor: c.bgElev,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.border,
                padding: 16,
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>
                  {getAttitudeEmoji(profile.average_attitude)}
                </Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: c.textMuted, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                  Actitud
                </Text>
              </View>

              {/* Nivel */}
              <View style={{
                flex: 1,
                backgroundColor: c.bgElev,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: c.border,
                padding: 16,
                alignItems: 'center',
              }}>
                <Ionicons name="speedometer-outline" size={22} color={c.warning} style={{ marginBottom: 8 }} />
                <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 26, fontWeight: '900', color: c.warning, marginBottom: 2 }}>
                  {profile.average_level > 0 ? profile.average_level.toFixed(1) : '—'}
                </Text>
                <Text style={{ fontSize: 10, fontWeight: '700', color: c.textMuted, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
                  Nivel
                </Text>
              </View>
            </View>
          )}

          <PendingReviewsAlert />

          <TouchableOpacity
            onPress={startEditing}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 16,
              paddingVertical: 14,
              alignItems: 'center',
              marginTop: 4,
              marginBottom: 10,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>Editar perfil</Text>
          </TouchableOpacity>

          {/* Sign out */}
          <TouchableOpacity
            onPress={signOut}
            style={{ 
              backgroundColor: 'rgba(239,68,68,0.08)', 
              borderWidth: 1, 
              borderColor: 'rgba(239,68,68,0.25)', 
              borderRadius: 16, 
              paddingVertical: 14, 
              alignItems: 'center', 
              marginTop: 10,
              marginBottom: 8 
            }}
          >
            <Text style={{ color: c.danger, fontWeight: '700' }}>Cerrar sesión</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ── Edit mode ────────────────────────────────────────────────────────────
  const lbl = {
    fontSize: 11, fontWeight: '600' as const, color: c.textDim,
    marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' as const,
  };

  const canSave = !saving && !loadingPhone && !usernameChecking && !usernameError;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
          paddingBottom: FLOATING_TAB_BAR_HEIGHT + insets.bottom + 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Edit header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, marginBottom: 16 }}>
          <TouchableOpacity onPress={cancelEditing} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="chevron-back" size={22} color={c.textDim} />
            <Text style={{ color: c.textDim, fontWeight: '600' }}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 18, fontWeight: '900', color: c.text }}>Editar perfil</Text>
          <View style={{ width: 80 }} />
        </View>

        {/* Avatar */}
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{ position: 'relative' }}>
            {isSafeUrl(profile.avatar_url) ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={{ width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: c.brand }}
              />
            ) : (
              <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: c.brandSoft, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: c.brand }}>
                <Text style={{ fontSize: 32, color: c.brand, fontWeight: '800' }}>
                  {profile.full_name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: c.brand, width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bgElev }}
              onPress={pickImage}
              disabled={uploading}
            >
              {uploading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={14} color="#fff" />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Info section */}
        <View style={sectionCard}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: c.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Información
          </Text>
          <View style={{ gap: 14 }}>
            {/* Full name */}
            <View>
              <Text style={lbl}>Nombre completo</Text>
              <TextInput style={inp} value={fullName} onChangeText={setFullName} placeholder="Tu nombre" placeholderTextColor={c.textMuted} />
            </View>

            {/* Username */}
            <View>
              <Text style={[lbl, !!usernameError && { color: c.danger }]}>Nombre de usuario</Text>
              <View style={{ position: 'relative', justifyContent: 'center' }}>
                <TextInput
                  style={{ ...inp, paddingRight: 44, borderColor: usernameError ? c.danger : 'rgba(255,255,255,0.08)' }}
                  value={username}
                  onChangeText={checkUsername}
                  placeholder="usuario"
                  placeholderTextColor={c.textMuted}
                  autoCapitalize="none"
                />
                <View style={{ position: 'absolute', right: 14 }}>
                  {usernameChecking && <ActivityIndicator size="small" color={c.textDim} />}
                  {!usernameChecking && username.length >= 3 && !usernameError && <Ionicons name="checkmark-circle" size={20} color={c.brand} />}
                  {!usernameChecking && usernameError !== '' && <Ionicons name="close-circle" size={20} color={c.danger} />}
                </View>
              </View>
              {!!usernameError && <Text style={{ color: c.danger, fontSize: 11, marginTop: 4 }}>{usernameError}</Text>}
            </View>

            {/* Phone */}
            <View>
              <Text style={lbl}>Teléfono <Text style={{ textTransform: 'none', color: c.textMuted }}>(privado)</Text></Text>
              {loadingPhone ? (
                <View style={{ ...inp, justifyContent: 'center' }}>
                  <ActivityIndicator size="small" color={c.textDim} />
                </View>
              ) : (
                <TextInput
                  style={inp}
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/[^0-9+\s]/g, ''))}
                  keyboardType="phone-pad"
                  placeholder="Ej: 600 123 456"
                  placeholderTextColor={c.textMuted}
                />
              )}
            </View>

            {/* Bio */}
            <View>
              <Text style={lbl}>Sobre mí</Text>
              <TextInput
                style={{ ...inp, minHeight: 100, textAlignVertical: 'top', paddingTop: 13 }}
                value={bio}
                onChangeText={setBio}
                placeholder="Cuéntanos un poco sobre ti..."
                placeholderTextColor={c.textMuted}
                multiline
              />
            </View>

            {/* Position */}
            <View>
              <Text style={lbl}>Posición principal</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {POSITIONS.map((pos) => {
                  const active = preferredPosition === pos;
                  return (
                    <TouchableOpacity
                      key={pos}
                      onPress={() => setPreferredPosition(pos === preferredPosition ? '' : pos)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1,
                        backgroundColor: active ? c.brandSoft : 'rgba(255,255,255,0.04)',
                        borderColor: active ? c.brand : 'rgba(255,255,255,0.08)',
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>{POSITION_EMOJIS[pos]}</Text>
                      <Text style={{ color: active ? c.brand : c.text, fontWeight: '600', fontSize: 13, textTransform: 'capitalize' }}>
                        {pos}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        </View>

        {/* Save */}
        <TouchableOpacity
          onPress={handleSaveProfile}
          disabled={!canSave}
          style={{ backgroundColor: canSave ? c.brand : c.brandDeep, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginBottom: 14, opacity: canSave ? 1 : 0.5 }}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: 'Archivo_900Black', fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 1 }}>Guardar cambios</Text>}
        </TouchableOpacity>

        {/* Account section */}
        <View style={sectionCard}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: c.textDim, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 16 }}>
            Cuenta
          </Text>

          {/* Email */}
          <View style={{ marginBottom: 16 }}>
            <Text style={lbl}>Email actual</Text>
            <View style={{ ...inp, justifyContent: 'center', marginBottom: 10 }}>
              <Text style={{ color: c.textDim }}>{user.email}</Text>
            </View>
            <Text style={{ fontSize: 11, color: c.textMuted, marginBottom: 8 }}>Nuevo email — recibirás un enlace de confirmación</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={{ ...inp, flex: 1 }}
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="nuevo@email.com"
                placeholderTextColor={c.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TouchableOpacity
                onPress={handleUpdateEmail}
                disabled={savingEmail || !newEmail.trim()}
                style={{ paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: newEmail.trim() ? c.brand : c.bgSurface }}
              >
                {savingEmail
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ fontWeight: '700', color: newEmail.trim() ? '#fff' : c.textMuted, fontSize: 13 }}>Cambiar</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {/* Password */}
          <View>
            <Text style={lbl}>Nueva contraseña</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', ...inp, paddingVertical: 0 }}>
                <TextInput
                  style={{ flex: 1, color: c.text, fontSize: 15, paddingVertical: 13 }}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
                  placeholderTextColor={c.textMuted}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={{ paddingHorizontal: 10 }}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.textDim} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={handleUpdatePassword}
                disabled={savingPassword || newPassword.length < MIN_PASSWORD_LENGTH}
                style={{ paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: newPassword.length >= MIN_PASSWORD_LENGTH ? c.brand : c.bgSurface }}
              >
                {savingPassword
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ fontWeight: '700', color: newPassword.length >= MIN_PASSWORD_LENGTH ? '#fff' : c.textMuted, fontSize: 13 }}>Cambiar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Danger zone */}
        <View style={sectionCard}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: c.danger, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
            Zona de peligro
          </Text>
          <TouchableOpacity
            onPress={handleDeleteAccount}
            style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', borderRadius: 14, paddingVertical: 13, alignItems: 'center' }}
          >
            <Text style={{ color: c.danger, fontWeight: '700' }}>Eliminar mi cuenta permanentemente</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
