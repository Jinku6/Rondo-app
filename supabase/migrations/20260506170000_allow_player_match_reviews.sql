-- Allow attended players to review the organizer and other attended players.
CREATE POLICY "Reviews: insert by attended player"
ON public.match_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = reviewer_id
  AND reviewer_id <> reviewee_id
  AND EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = match_reviews.match_id
      AND m.status = 'completed'
  )
  AND EXISTS (
    SELECT 1
    FROM public.match_participants reviewer
    WHERE reviewer.match_id = match_reviews.match_id
      AND reviewer.user_id = auth.uid()
      AND reviewer.status IN ('joined', 'approved')
      AND reviewer.attended = true
  )
  AND (
    EXISTS (
      SELECT 1
      FROM public.matches m
      WHERE m.id = match_reviews.match_id
        AND m.organizer_id = match_reviews.reviewee_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.match_participants reviewee
      WHERE reviewee.match_id = match_reviews.match_id
        AND reviewee.user_id = match_reviews.reviewee_id
        AND reviewee.status IN ('joined', 'approved')
        AND reviewee.attended = true
    )
  )
);
