import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { blockUser, unblockUser, fetchMyBlocks, BlockedUser } from '../lib/blocks';

// Общий стор блокировок. Сервер и так прячет заблокированных в RPC/RLS, но между
// 30-с опросами «рядом»/площадки нужен мгновенный UX: заблокировал — исчез сразу.
// Стор также питает экран «Заблокированные». Модульный (а не контекст): блок,
// сделанный в callout метки, тут же виден в NearbyDogsSheet без проп-проводки.

let blocked: BlockedUser[] = [];
let blockedIds = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setBlocked(next: BlockedUser[]) {
  blocked = next;
  blockedIds = new Set(next.map((b) => b.user_id));
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

// Загрузка свежего списка с сервера (источник правды). Вызывается хуком на монтаже
// и после block/unblock.
export async function refreshBlocks(): Promise<void> {
  setBlocked(await fetchMyBlocks());
}

// Оптимистично прячем (мгновенный UX), затем RPC; при ошибке — откат через refetch.
// Возвращает текст ошибки или null.
export async function blockAndHide(user: {
  userId: string;
  displayName?: string | null;
  dogName?: string | null;
  dogAvatar?: string | null;
}): Promise<string | null> {
  if (!blockedIds.has(user.userId)) {
    setBlocked([
      {
        user_id: user.userId,
        display_name: user.displayName ?? null,
        dog_name: user.dogName ?? null,
        dog_avatar: user.dogAvatar ?? null,
        created_at: new Date().toISOString(),
      },
      ...blocked,
    ]);
  }
  const err = await blockUser(user.userId);
  await refreshBlocks(); // синхронизируем с сервером (успех — подтверждаем, ошибка — откат)
  return err;
}

export async function unblockAndShow(userId: string): Promise<string | null> {
  const err = await unblockUser(userId);
  await refreshBlocks();
  return err;
}

// Один раз подгружаем список при первом использовании хука где-либо; дальше —
// только явный refresh или block/unblock. Гость (нет сессии) получит [] и флаг
// снимется сам.
let hasLoaded = false;

// Список + набор id + действия. list обновляется реактивно через стор.
export function useBlocks() {
  const list = useSyncExternalStore(subscribe, () => blocked);
  // blockedIds пересобирается вместе с list (та же мутация setBlocked), поэтому
  // ссылка стабильна между изменениями стора.
  const ids = useSyncExternalStore(subscribe, () => blockedIds);
  const refresh = useCallback(() => refreshBlocks(), []);
  useEffect(() => {
    if (hasLoaded) return;
    hasLoaded = true;
    refreshBlocks();
  }, []);
  return {
    blocked: list,
    blockedIds: ids,
    block: blockAndHide,
    unblock: unblockAndShow,
    refresh,
  };
}
