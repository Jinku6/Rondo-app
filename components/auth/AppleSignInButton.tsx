import React, { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';

import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { signInWithApple } from '@/lib/auth/signInWithApple';

type AppleSignInButtonProps = {
  height?: number;
};

export function AppleSignInButton({ height = 52 }: AppleSignInButtonProps) {
  const [loading, setLoading] = useState(false);
  const { refreshProfile } = useAuth();
  const { scheme } = useTheme();

  if (Platform.OS !== 'ios') return null;

  const handlePress = async () => {
    if (loading) return;

    setLoading(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      await signInWithApple(credential);
      await refreshProfile();
    } catch (e: any) {
      if (e?.code === 'ERR_REQUEST_CANCELED') return;
      console.error('[AppleSignIn]', e);
      Alert.alert('Algo falló', 'No pudimos entrar con Apple. Probá de nuevo en un momento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ opacity: loading ? 0.7 : 1 }}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={scheme === 'dark'
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={14}
        onPress={handlePress}
        style={{ width: '100%', height }}
      />
    </View>
  );
}
