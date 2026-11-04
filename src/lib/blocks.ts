import { supabase } from './supabase';

// Блокировка пользователей (UGC-требование Google Play). Блок — взаимный:
// заблокированный исчезает из «рядом», присутствия на площадке, превью и не может
// слать заявку в дружбу (сервер прячет через public.is_blocked). Запись идёт ТОЛЬКО
// через SECURITY DEFINER RPC block_user/unblock_user — таблица blocks без
// write-политик (см. supabase/functions/*). block_user атомарно рвёт дружбу в обе
// стороны. Возвращают текст ошибки или null при успехе (как lib/friendships).

export interface BlockedUser {
  user_id: string;
  display_name: string | null;
  dog_name: string | null;
  dog_avatar: string | null;
  created_at: string;
}

export async function blockUser(userId: string): Promise<string | null> {
  const { error } = await supabase.rpc('block_user', { p_user_id: userId });
  return error ? error.message : null;
}

export async function unblockUser(userId: string): Promise<string | null> {
  const { error } = await supabase.rpc('unblock_user', { p_user_id: userId });
  return error ? error.message : null;
}

// Свой список блокировок с превью (имя + собака). Отдельная RPC, потому что
// get_user_previews заблокированных намеренно прячет — через неё имена для экрана
// «Заблокированные» не получить. Пустой массив при ошибке (как lib/userPreviews).
export async function fetchMyBlocks(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc('get_my_blocks');
  if (error) {
    console.warn('[blocks] get_my_blocks error:', error.message);
    return [];
  }
  return (data ?? []) as BlockedUser[];
}
