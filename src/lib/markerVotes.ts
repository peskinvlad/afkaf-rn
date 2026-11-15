import { supabase } from './supabase';

// Голос за актуальность метки — один на пару (метка, пользователь). Общий путь
// для карточки метки (MarkerCallout) и уведомления №5 «Метка ещё актуальна?».
// Пишется через RPC cast_marker_vote (SECURITY DEFINER): user_id берётся из
// auth.uid() на сервере, клиент его не шлёт. Сервер проверяет rate-limit (PT429),
// запрет голоса за свою метку (PT403), сам upsert. Возвращает текст ошибки или
// null при успехе (supabase-js не бросает) — вызывающий показывает общий Alert.
export type MarkerVote = 'still_there' | 'gone';

export async function castMarkerVote(
  markerId: string,
  vote: MarkerVote,
): Promise<string | null> {
  const { error } = await supabase.rpc('cast_marker_vote', {
    p_marker_id: markerId,
    p_vote: vote,
  });
  return error ? error.message : null;
}
