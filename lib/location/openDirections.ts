import { ActionSheetIOS, Alert, Linking, Platform, type AlertButton } from 'react-native';

type DirectionPlatform = 'ios' | 'android' | 'web' | 'windows' | 'macos';
type DirectionAppId = 'google_maps' | 'waze' | 'apple_maps' | 'system_maps';

export interface DirectionOption {
  id: DirectionAppId;
  label: string;
  nativeUrl: string;
  fallbackUrl: string;
}

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

export function buildDirectionsOptions({
  latitude,
  longitude,
  label,
  platform,
}: {
  latitude: number;
  longitude: number;
  label: string;
  platform: DirectionPlatform;
}): DirectionOption[] {
  const encodedLabel = encodeURIComponent(label);
  const googleFallback = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  const wazeFallback = `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;

  const options: DirectionOption[] = [
    {
      id: 'google_maps',
      label: 'Google Maps',
      nativeUrl:
        platform === 'android'
          ? `google.navigation:q=${latitude},${longitude}`
          : `comgooglemaps://?daddr=${latitude},${longitude}&directionsmode=driving`,
      fallbackUrl: googleFallback,
    },
    {
      id: 'waze',
      label: 'Waze',
      nativeUrl: `waze://?ll=${latitude},${longitude}&navigate=yes`,
      fallbackUrl: wazeFallback,
    },
  ];

  if (platform === 'ios') {
    options.push({
      id: 'apple_maps',
      label: 'Mapas',
      nativeUrl: `maps://?q=${encodedLabel}&ll=${latitude},${longitude}`,
      fallbackUrl: buildDirectionsUrl({ latitude, longitude, label, platform: 'web' }),
    });
  } else {
    options.push({
      id: 'system_maps',
      label: 'App de mapas',
      nativeUrl: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`,
      fallbackUrl: buildDirectionsUrl({ latitude, longitude, label, platform: 'web' }),
    });
  }

  return options;
}

export async function buildAvailableDirectionsOptions(
  options: DirectionOption[],
  canOpenUrl: (url: string) => Promise<boolean> = Linking.canOpenURL
): Promise<DirectionOption[]> {
  const checks = await Promise.all(
    options.map(async (option) => {
      try {
        const canOpen = await canOpenUrl(option.nativeUrl);
        return canOpen ? option : null;
      } catch {
        return null;
      }
    })
  );

  return checks.filter((option): option is DirectionOption => !!option);
}

async function openDirectionOption(option: DirectionOption): Promise<void> {
  try {
    const canOpen = await Linking.canOpenURL(option.nativeUrl);
    await Linking.openURL(canOpen ? option.nativeUrl : option.fallbackUrl);
  } catch {
    await Linking.openURL(option.fallbackUrl);
  }
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
  const options = buildDirectionsOptions({ latitude, longitude, label, platform: Platform.OS });

  try {
    const availableOptions = Platform.OS === 'ios'
      ? options
      : await buildAvailableDirectionsOptions(options);
    const visibleOptions = availableOptions.length > 0 ? availableOptions : [options[options.length - 1]];

    if (visibleOptions.length === 1) {
      await openDirectionOption(visibleOptions[0]);
      return;
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Abrir con',
          message: label,
          options: [...visibleOptions.map((option) => option.label), 'Cancelar'],
          cancelButtonIndex: visibleOptions.length,
        },
        (selectedIndex) => {
          const option = visibleOptions[selectedIndex];
          if (option) {
            openDirectionOption(option).catch(() => {
              Alert.alert('No hemos podido abrir la app de mapas.');
            });
          }
        }
      );
      return;
    }

    if (Platform.OS === 'android') {
      const buttons: AlertButton[] = visibleOptions.map((option) => ({
        text: option.label,
        onPress: () => openDirectionOption(option).catch(() => {
          Alert.alert('No hemos podido abrir la app de mapas.');
        }),
      }));
      if (buttons.length < 3) {
        buttons.push({ text: 'Cancelar', style: 'cancel' });
      }

      Alert.alert(
        'Abrir con',
        label,
        buttons,
        { cancelable: true }
      );
      return;
    }

    await Linking.openURL(buildDirectionsUrl({ latitude, longitude, label, platform: 'web' }));
  } catch {
    Alert.alert('No hemos podido abrir la app de mapas.');
  }
}
