import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type PendingReviewType = 'pending_organizer_review' | 'pending_player_review';

export interface PendingReviewNotification {
  id: string;
  user_id: string;
  match_id: string;
  type: PendingReviewType;
  read: boolean;
  created_at: string;
  match?: { title: string } | null;
}

interface ActivityContextValue {
  messagesBadgeCount: number | undefined;
  matchesBadgeCount: number | undefined;
  pendingReviews: PendingReviewNotification[];
  refreshActivity: () => Promise<void>;
}

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);

const toBadge = (count: number) => (count > 0 ? count : undefined);

export function ActivityProvider({ children, user }: { children: React.ReactNode; user: User | null }) {
  const [messagesBadgeCount, setMessagesBadgeCount] = useState<number | undefined>(undefined);
  const [matchesBadgeCount, setMatchesBadgeCount] = useState<number | undefined>(undefined);
  const [pendingReviews, setPendingReviews] = useState<PendingReviewNotification[]>([]);

  const refreshActivity = useCallback(async () => {
    if (!user) {
      setMessagesBadgeCount(undefined);
      setMatchesBadgeCount(undefined);
      setPendingReviews([]);
      return;
    }

    try {
      const [{ data: unreadChats }, { data: reviews }, { data: myMatches }] = await Promise.all([
        supabase.rpc('get_unread_count'),
        supabase
          .from('notifications')
          .select('*, match:matches(title)')
          .eq('user_id', user.id)
          .eq('read', false)
          .in('type', ['pending_organizer_review', 'pending_player_review']),
        supabase
          .from('matches')
          .select('id')
          .eq('organizer_id', user.id),
      ]);

      setPendingReviews((reviews ?? []) as PendingReviewNotification[]);
      setMessagesBadgeCount(toBadge((unreadChats ?? 0) + (reviews?.length ?? 0)));

      if (!myMatches?.length) {
        setMatchesBadgeCount(undefined);
        return;
      }

      const matchIds = myMatches.map((match: { id: string }) => match.id);
      const { data: pendingParticipants } = await supabase
        .from('match_participants')
        .select('id')
        .in('match_id', matchIds)
        .eq('status', 'pending');

      setMatchesBadgeCount(toBadge(pendingParticipants?.length ?? 0));
    } catch (error) {
      if (__DEV__) console.warn('refresh activity error:', error);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      void refreshActivity();
      return;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      void refreshActivity();
    });

    return () => task.cancel();
  }, [refreshActivity, user]);

  return (
    <ActivityContext.Provider value={{ messagesBadgeCount, matchesBadgeCount, pendingReviews, refreshActivity }}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) {
    throw new Error('useActivity debe usarse dentro de <ActivityProvider>');
  }
  return context;
}
