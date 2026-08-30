import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { pickSquareAvatar, type AvatarAsset } from '@/lib/avatarUpload';
import { containsProfanity } from '@/lib/profanityFilter';
import { isSafeUrl } from '@/lib/utils';
import { useTheme } from '@/hooks/use-theme';
import type { MatchSeries } from '@/types/series';

export type TeamEditValues = {
  title: string;
  city: string | null;
  description: string | null;
  pricePerPlayer: number;
  avatarUrl: string | null;
  avatarAsset: AvatarAsset | null;
};

type Props = {
  visible: boolean;
  team: Pick<MatchSeries, 'title' | 'city' | 'description' | 'price_per_player' | 'avatar_url'>;
  saving: boolean;
  onClose: () => void;
  onSave: (values: TeamEditValues) => void;
};

export function TeamEditModal({ visible, team, saving, onClose, onSave }: Props) {
  const { colors: c } = useTheme();
  const s = useMemo(() => createStyles(c), [c]);
  const [title, setTitle] = useState(team.title);
  const [city, setCity] = useState(team.city ?? '');
  const [description, setDescription] = useState(team.description ?? '');
  const [price, setPrice] = useState(String(team.price_per_player));
  const [avatarAsset, setAvatarAsset] = useState<AvatarAsset | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(team.title);
    setCity(team.city ?? '');
    setDescription(team.description ?? '');
    setPrice(String(team.price_per_player));
    setAvatarAsset(null);
  }, [team, visible]);

  const pickAvatar = async () => {
    try {
      const asset = await pickSquareAvatar();
      if (asset) setAvatarAsset(asset);
    } catch (error) {
      Alert.alert('No se pudo abrir la galería', error instanceof Error ? error.message : 'Prueba de nuevo.');
    }
  };

  const submit = () => {
    const normalizedTitle = title.trim();
    const normalizedCity = city.trim();
    const normalizedDescription = description.trim();
    const parsedPrice = Number(price.replace(',', '.'));

    if (normalizedTitle.length < 3 || normalizedTitle.length > 100) {
      Alert.alert('Revisa el nombre', 'Debe tener entre 3 y 100 caracteres.');
      return;
    }
    if (normalizedCity && (normalizedCity.length < 2 || normalizedCity.length > 80)) {
      Alert.alert('Revisa la ciudad', 'Debe tener entre 2 y 80 caracteres o quedar vacía.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || parsedPrice > 10000) {
      Alert.alert('Revisa el precio', 'Debe estar entre 0 y 10.000 €.');
      return;
    }
    if (normalizedDescription.length > 300) {
      Alert.alert('Revisa la descripción', 'No puede superar los 300 caracteres.');
      return;
    }
    if (containsProfanity(normalizedTitle) || containsProfanity(normalizedCity) || containsProfanity(normalizedDescription)) {
      Alert.alert('Vocabulario no permitido', 'Usa palabras respetuosas en los datos del equipo.');
      return;
    }

    onSave({
      title: normalizedTitle,
      city: normalizedCity || null,
      description: normalizedDescription || null,
      pricePerPlayer: parsedPrice,
      avatarUrl: team.avatar_url,
      avatarAsset,
    });
  };

  const initials = team.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0]?.toUpperCase())
    .join('') || 'FC';
  const previewUri = avatarAsset?.uri || (isSafeUrl(team.avatar_url) ? team.avatar_url : null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.root}
      >
        <Pressable style={s.scrim} onPress={saving ? undefined : onClose} />
        <View style={s.sheet}>
          <View style={s.header}>
            <View style={s.headerCopy}>
              <Text style={s.title}>Editar equipo</Text>
              <Text style={s.subtitle}>Lo habitual del vestuario, siempre a mano.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar edición del equipo"
              disabled={saving}
              onPress={onClose}
              style={({ pressed }) => [s.closeButton, pressed && s.pressed]}
            >
              <Ionicons name="close" size={23} color={c.textDim} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cambiar foto del equipo"
              disabled={saving}
              onPress={() => void pickAvatar()}
              style={({ pressed }) => [s.avatarButton, pressed && s.pressed]}
            >
              <View style={s.avatar}>
                {previewUri ? (
                  <Image source={{ uri: previewUri }} style={s.avatarImage} />
                ) : (
                  <Text style={s.avatarInitials}>{initials}</Text>
                )}
                <View style={s.cameraBadge}>
                  <Ionicons name="camera" size={15} color={c.brandInk} />
                </View>
              </View>
              <Text style={s.avatarLabel}>Cambiar foto</Text>
              <Text style={s.avatarHint}>JPG, PNG o WebP · máximo 2 MB</Text>
            </Pressable>

            <View style={s.field}>
              <Text style={s.label}>Nombre del equipo</Text>
              <TextInput
                accessibilityLabel="Nombre del equipo"
                value={title}
                onChangeText={setTitle}
                editable={!saving}
                maxLength={100}
                autoCapitalize="sentences"
                placeholder="Los del jueves"
                placeholderTextColor={c.textMuted}
                style={s.input}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Ciudad habitual</Text>
              <TextInput
                accessibilityLabel="Ciudad habitual del equipo"
                value={city}
                onChangeText={setCity}
                editable={!saving}
                maxLength={80}
                autoCapitalize="words"
                placeholder="Madrid"
                placeholderTextColor={c.textMuted}
                style={s.input}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Descripción</Text>
              <TextInput
                accessibilityLabel="Descripción del equipo"
                value={description}
                onChangeText={setDescription}
                editable={!saving}
                maxLength={300}
                multiline
                numberOfLines={4}
                placeholder="Quiénes sois y qué ambiente hay en el vestuario"
                placeholderTextColor={c.textMuted}
                style={[s.input, s.descriptionInput]}
              />
              <Text style={s.characterCount}>{description.length}/300</Text>
            </View>

            <View style={s.field}>
              <Text style={s.label}>Precio habitual por jugador (€)</Text>
              <TextInput
                accessibilityLabel="Precio habitual por jugador"
                value={price}
                onChangeText={setPrice}
                editable={!saving}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={c.textMuted}
                style={s.input}
              />
              <Text style={s.hint}>Podrás cambiarlo en cada pachanga.</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Guardar cambios del equipo"
              disabled={saving}
              onPress={submit}
              style={({ pressed }) => [s.saveButton, (saving || pressed) && s.pressed]}
            >
              {saving ? (
                <ActivityIndicator color={c.brandInk} />
              ) : (
                <View style={s.saveButtonContent}>
                  <Ionicons name="checkmark-circle-outline" size={19} color={c.brandInk} />
                  <Text style={s.saveButtonText}>Guardar cambios</Text>
                </View>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (c: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: c.scrim },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: c.border,
    backgroundColor: c.bgElev,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 20 },
  headerCopy: { flex: 1 },
  title: { color: c.text, fontFamily: 'Archivo_900Black', fontSize: 22, fontWeight: '900' },
  subtitle: { color: c.textDim, fontSize: 13, lineHeight: 19, marginTop: 4 },
  closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65 },
  avatarButton: { alignItems: 'center', minHeight: 132, marginBottom: 18 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: c.brand,
    backgroundColor: c.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 44 },
  avatarInitials: { color: c.text, fontFamily: 'Archivo_900Black', fontSize: 25, fontWeight: '900' },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: c.bgElev,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { color: c.brand, fontSize: 13, fontWeight: '800', marginTop: 8 },
  avatarHint: { color: c.textMuted, fontSize: 11, marginTop: 3 },
  field: { marginBottom: 16 },
  label: {
    color: c.textDim,
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.inputBg,
    color: c.text,
    fontSize: 15,
    paddingHorizontal: 15,
  },
  descriptionInput: {
    minHeight: 96,
    paddingTop: 14,
    paddingBottom: 14,
    textAlignVertical: 'top',
  },
  characterCount: {
    color: c.textMuted,
    fontSize: 11,
    marginTop: 6,
    textAlign: 'right',
  },
  hint: { color: c.textMuted, fontSize: 11, marginTop: 6 },
  saveButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: c.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: c.brandGlow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  saveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: c.brandInk,
    fontFamily: 'Archivo_900Black',
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
