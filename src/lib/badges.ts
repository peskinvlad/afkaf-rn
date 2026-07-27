import { supabase } from './supabase';
import { BADGES, BadgeDef } from '../constants/badges';

function toDateStr(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

// Current streak of consecutive calendar days with a valid walk, ending
// today (or yesterday, if today's walk hasn't happened yet) — a missed day
// resets it to 0.
function computeStreak(startedAtList: string[]): number {
  const days = new Set(startedAtList.map(toDateStr));
  const cursor = new Date();
  if (!days.has(toDateStr(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (days.has(toDateStr(cursor.toISOString()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

interface Stats {
  totalKm: number;
  walkCount: number;
  streak: number;
  confirmedCount: number;
}

function isEligible(badge: BadgeDef, stats: Stats): boolean {
  switch (badge.category) {
    case 'walk':
      return badge.id === 'first_walk' ? stats.walkCount >= 1 : stats.totalKm >= badge.threshold;
    case 'marker':
      return stats.confirmedCount >= badge.threshold;
    case 'streak':
      return stats.streak >= badge.threshold;
  }
}

// Checks every badge against the caller's current walk_history + marker
// trust stats, awards any newly-earned ones, and returns just the ones
// that were newly awarded this call (for the "new milestone" card).
export async function checkAndAwardBadges(confirmedCount: number): Promise<BadgeDef[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return [];

  const [{ data: walks }, { data: existing }] = await Promise.all([
    supabase.from('walk_history').select('distance_km, started_at').eq('user_id', userId),
    supabase.from('user_badges').select('badge_id').eq('user_id', userId),
  ]);

  const stats: Stats = {
    totalKm: (walks ?? []).reduce((sum, w) => sum + w.distance_km, 0),
    walkCount: (walks ?? []).length,
    streak: computeStreak((walks ?? []).map((w) => w.started_at)),
    confirmedCount,
  };

  const existingIds = new Set((existing ?? []).map((r) => r.badge_id));
  const toAward = BADGES.filter((b) => !existingIds.has(b.id) && isEligible(b, stats));

  if (toAward.length === 0) return [];

  const { error } = await supabase
    .from('user_badges')
    .insert(toAward.map((b) => ({ user_id: userId, badge_id: b.id })));

  return error ? [] : toAward;
}
