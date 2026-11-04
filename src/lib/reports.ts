import { supabase } from './supabase';

// Жалоба на метку или пользователя (UGC-требование Google Play). RLS reports_insert
// требует reporter_id = auth.uid() (см. supabase/policies/reports.sql). Дубликат —
// та же открытая жалоба на ту же цель — ловится частичным уникальным индексом
// reports_one_open_per_target и приходит кодом 23505; для пользователя это тот же
// исход «спасибо», поэтому считаем его успехом. Возвращает текст ошибки или null
// при успехе/дубле (supabase-js не бросает — как остальные lib/*).

export type ReportTargetType = 'marker' | 'user';

// Канон кодов причин = reports_reason_check в БД. UI показывает разные подмножества
// для метки и пользователя (см. ReportSheet); сюда приходит уже выбранный код.
export type ReportReason =
  | 'missing'        // метки нет на месте
  | 'wrong_location' // неверное место
  | 'wrong_type'     // неверный тип метки
  | 'inappropriate'  // оскорбительный текст / имя / фото
  | 'spam'
  | 'harassment'
  | 'impersonation'
  | 'dangerous'
  | 'other';

export async function submitReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
  comment?: string | null,
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'not_authenticated';

  const trimmed = comment?.trim();
  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    reason,
    comment: trimmed ? trimmed : null,
  });

  if (!error) return null;
  // 23505 unique_violation — уже есть открытая жалоба на эту цель: для UX это успех.
  if ((error as { code?: string }).code === '23505') return null;
  return error.message;
}
