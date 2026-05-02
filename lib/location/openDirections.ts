import { Alert, Linking, Platform } from 'react-native';

type DirectionPlatform = 'ios' | 'android' | 'web' | 'windows' | 'macos';

export function buildDirectionsUrl({
  latitude,
  longitude,
  label,
  platform,
}: {
  latitude: number;
  longitude: number;
  label: string;
  platform: DirectionPlatform;
}): string {
  const encodedLabel = encodeURIComponent(label);

  if (platform === 'ios') {
    return `maps://?q=${encodedLabel}&ll=${latitude},${longitude}`;
  }

  if (platform === 'android') {
    return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export async function openDirections({
  latitude,
  longitude,
  label,
}: {
  latitude: number;
  longitude: number;
  label: string;
}): Promise<void> {
  const fallbackUrl = buildDirectionsUrl({ latitude, longitude, label, platform: 'web' });
  const nativeUrl = buildDirectionsUrl({ latitude, longitude, label, platform: Platform.OS });

  try {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const canOpen = await Linking.canOpenURL(nativeUrl);
      await Linking.openURL(canOpen ? nativeUrl : fallbackUrl);
      return;
    }

    await Linking.openURL(fallbackUrl);
  } catch {
    try {
      await Linking.openURL(fallbackUrl);
    } catch {
      Alert.alert('No hemos podido abrir la app de mapas.');
    }
  }
}
