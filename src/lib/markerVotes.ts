import { supabase } from './supabase';

// Голос за актуальность метки — один на пару (метка, пользователь). Общий путь
// для карточки метки (MarkerCallout) и уведомления №5 «Метка ещё актуальна?».
// Возвращает текст ошибки или null при успехе (supabase-js не бросает).
export type MarkerVote = 'still_there' | 'gone';

export async function castMarkerVote(
  markerId: string,
  userId: string,
  vote: MarkerVote,
): Promise<string | null> {
  const { error } = await supabase
    .from('marker_votes')
    .upsert({ marker_id: markerId, user_id: userId, vote }, { onConflict: 'marker_id,user_id' });
  return error ? error.message : null;
}
