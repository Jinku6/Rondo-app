import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

import { supabase } from '@/lib/supabase';

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const AVATAR_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type AvatarAsset = ImagePicker.ImagePickerAsset;

export async function pickSquareAvatar(): Promise<AvatarAsset | null> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    return result.canceled ? null : result.assets?.[0] ?? null;
  } catch (error) {
    throw error;
  }
}

export async function uploadAvatar({
  asset,
  folder,
}: {
  asset: AvatarAsset;
  folder?: string;
}): Promise<string> {
  try {
    const mimeType = asset.mimeType ?? '';
    const fileExt = AVATAR_MIME_EXTENSIONS[mimeType];

    if (!asset.base64) throw new Error('No se pudo leer la imagen seleccionada.');
    if (!fileExt) throw new Error('Formato no permitido. Usa JPG, PNG o WebP.');
    if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_AVATAR_BYTES) {
      throw new Error('La imagen debe pesar menos de 2 MB.');
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!userData.user) throw new Error('Inicia sesión de nuevo para subir una imagen.');

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session || sessionData.session.user.id !== userData.user.id) {
      throw new Error('Tu sesión ya no es válida. Inicia sesión de nuevo para subir una imagen.');
    }

    const normalizedFolder = folder?.replace(/^\/+|\/+$/g, '');
    const fileName = [userData.user.id, normalizedFolder, `${Date.now()}.${fileExt}`]
      .filter(Boolean)
      .join('/');
    const { error } = await supabase.storage.from('avatars').upload(
      fileName,
      decode(asset.base64),
      {
        cacheControl: '3600',
        upsert: true,
        contentType: mimeType,
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      },
    );
    if (error) throw error;

    return supabase.storage.from('avatars').getPublicUrl(fileName).data.publicUrl;
  } catch (error) {
    throw error;
  }
}
