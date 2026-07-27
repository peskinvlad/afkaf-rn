// Personal warm milestones — not a leaderboard, no comparison to other users.
// A badge is a reason to feel good about a walk or two, nothing more.

export type BadgeCategory = 'walk' | 'marker' | 'streak';

export interface BadgeDef {
  id: string;
  emoji: string;
  category: BadgeCategory;
  // walk: total km threshold (ignored for 'first_walk', which just needs 1 valid walk)
  // marker: confirmed-marker count threshold
  // streak: consecutive calendar days threshold
  threshold: number;
  titleKey: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'first_walk',   emoji: '🐾', category: 'walk', threshold: 0,   titleKey: 'badges.first_walk' },
  { id: 'walked_2km',   emoji: '🚶', category: 'walk', threshold: 2,   titleKey: 'badges.walked_2km' },
  { id: 'walked_5km',   emoji: '🌳', category: 'walk', threshold: 5,   titleKey: 'badges.walked_5km' },
  { id: 'walked_10km',  emoji: '🏞️', category: 'walk', threshold: 10,  titleKey: 'badges.walked_10km' },
  { id: 'walked_15km',  emoji: '🗺️', category: 'walk', threshold: 15,  titleKey: 'badges.walked_15km' },
  { id: 'walked_25km',  emoji: '⛰️', category: 'walk', threshold: 25,  titleKey: 'badges.walked_25km' },
  { id: 'walked_50km',  emoji: '🌍', category: 'walk', threshold: 50,  titleKey: 'badges.walked_50km' },
  { id: 'walked_100km', emoji: '🏆', category: 'walk', threshold: 100, titleKey: 'badges.walked_100km' },

  { id: 'marker_1',  emoji: '📍', category: 'marker', threshold: 1,  titleKey: 'badges.marker_1' },
  { id: 'marker_3',  emoji: '🔍', category: 'marker', threshold: 3,  titleKey: 'badges.marker_3' },
  { id: 'marker_5',  emoji: '🧭', category: 'marker', threshold: 5,  titleKey: 'badges.marker_5' },
  { id: 'marker_10', emoji: '🛡️', category: 'marker', threshold: 10, titleKey: 'badges.marker_10' },
  { id: 'marker_25', emoji: '🏅', category: 'marker', threshold: 25, titleKey: 'badges.marker_25' },

  { id: 'streak_3',  emoji: '🔥', category: 'streak', threshold: 3,  titleKey: 'badges.streak_3' },
  { id: 'streak_5',  emoji: '🔥', category: 'streak', threshold: 5,  titleKey: 'badges.streak_5' },
  { id: 'streak_7',  emoji: '🔥', category: 'streak', threshold: 7,  titleKey: 'badges.streak_7' },
  { id: 'streak_10', emoji: '💫', category: 'streak', threshold: 10, titleKey: 'badges.streak_10' },
  { id: 'streak_14', emoji: '✨', category: 'streak', threshold: 14, titleKey: 'badges.streak_14' },
  { id: 'streak_21', emoji: '🌙', category: 'streak', threshold: 21, titleKey: 'badges.streak_21' },
  { id: 'streak_30', emoji: '🌟', category: 'streak', threshold: 30, titleKey: 'badges.streak_30' },
];
