import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { firstParam } from '@/lib/utils';

export default function LegacyReviewRedirect() {
  const params = useLocalSearchParams();
  const id = firstParam(params.id as string | string[]);
  const router = useRouter();

  useEffect(() => {
    router.replace(id ? `/match/review-player/${id}` as any : '/(tabs)');
  }, [id, router]);

  return (
    <View className="flex-1 bg-neutral-950 justify-center items-center">
      <ActivityIndicator size="large" color="#22C55E" />
    </View>
  );
}
