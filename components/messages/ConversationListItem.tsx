import { Image, Pressable, Text, View } from 'react-native';

export interface ConversationListItemData {
  id: string;
  matchId: string;
  playerId: string;
  name: string;
  initials: string;
  lastMessage: string;
  timeLabel: string;
  avatarClassName: string;
  avatarUrl?: string | null;
  archived: boolean;
  unread?: boolean;
}

interface ConversationListItemProps {
  conversation: ConversationListItemData;
  onPress: (conversation: ConversationListItemData) => void;
}

export function ConversationListItem({ conversation, onPress }: ConversationListItemProps) {
  return (
    <Pressable
      onPress={() => onPress(conversation)}
      accessibilityRole="button"
      accessibilityLabel={`Abrir conversación con ${conversation.name}`}
      className="flex-row items-center gap-3 border-b border-white/10 py-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}
    >
      {conversation.avatarUrl ? (
        <Image
          source={{ uri: conversation.avatarUrl }}
          className="h-11 w-11 shrink-0 rounded-full border border-white/10"
        />
      ) : (
        <View
          className={`h-11 w-11 shrink-0 items-center justify-center rounded-full ${conversation.avatarClassName}`}
        >
          <Text className="font-display text-base text-white">{conversation.initials}</Text>
        </View>
      )}

      <View className="min-w-0 flex-1">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text className="flex-1 font-body text-base font-bold text-ink" numberOfLines={1}>
            {conversation.name}
          </Text>
          <Text className={`font-mono text-[10px] ${conversation.unread ? 'text-brand' : 'text-ink-dim'}`} numberOfLines={1}>
            {conversation.timeLabel}
          </Text>
        </View>

        <Text className={`mt-1 font-body text-sm ${conversation.unread ? 'text-ink' : 'text-ink-dim'}`} numberOfLines={1}>
          {conversation.lastMessage}
        </Text>
      </View>

      {conversation.unread && <View className="h-2.5 w-2.5 rounded-full bg-brand" />}
    </Pressable>
  );
}
