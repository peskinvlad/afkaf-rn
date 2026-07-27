import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useBadges() {
  const [earnedIds, setEarnedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) {
      setEarnedIds(new Set());
      setLoading(false);
      return;
    }
    const { data } = await supabase.from('user_badges').select('badge_id').eq('user_id', userId);
    setEarnedIds(new Set((data ?? []).map((r) => r.badge_id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { earnedIds, loading, refresh };
}
