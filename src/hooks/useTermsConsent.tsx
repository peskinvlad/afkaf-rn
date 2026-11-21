import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { clearLocalUserData } from '../lib/localReset';
import { navigationRef } from '../lib/navigationRef';
import { TERMS_VERSION } from '../constants/links';
import { TermsConsentScreen } from '../components/TermsConsentScreen';

// ── Согласие с условиями использования (Apple Guideline 1.2) ────────────────
//
// TermsConsentProvider монтируется ОДИН раз в RootNavigator вокруг навигатора и
// сам рисует TermsConsentScreen поверх всего приложения, когда у вошедшего
// пользователя нет согласия с текущей TERMS_VERSION. Поэтому экран появляется
// сразу после входа (и нового, и старого аккаунта) — поверх DogProfile/Main,
// пользоваться которыми до «Принимаю» нельзя, — и при первом запуске 1.0.0 у
// тех, кто уже вошёл раньше. Гостям — никогда (они ничего не публикуют).
//
// Страховка для мест, где создаётся контент: `await ensureAccepted()` перед
// сохранением. true — можно продолжать (согласие есть, или человек только что
// принял); false — человек нажал «Выйти». Нужна, когда статус при старте
// узнать не удалось (нет сети и нет кэша) — тогда экран при старте не
// навязываем, а показываем ровно перед публикацией.
//
// Хранение:
//   • источник правды — profiles.terms_accepted_at / terms_version (пишет только
//     RPC accept_terms, время сервера);
//   • кэш AsyncStorage `terms_accepted_v1:<uid>` = { version, pending } — чтобы
//     экран не мигал при каждом запуске и работал без сети;
//   • pending=true — человек принял, но RPC не прошёл (нет сети, PT404 и т.п.):
//     пускаем дальше, доотправляем при следующем запуске.

type Status =
  | 'idle'      // нет сессии (гость)
  | 'loading'   // читаем кэш/профиль
  | 'accepted'  // согласие с TERMS_VERSION есть (в БД или ожидает отправки)
  | 'needed'    // точно нет — показываем экран
  | 'unknown';  // не смогли прочитать профиль и нет кэша — спросим перед контентом

type CacheEntry = { version: string; pending: boolean };

const cacheKey = (uid: string) => `terms_accepted_v1:${uid}`;
const RPC_TIMEOUT_MS = 8_000;

async function readCache(uid: string): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.version !== 'string') return null;
    return { version: v.version, pending: v.pending === true };
  } catch {
    return null;
  }
}

async function writeCache(uid: string, entry: CacheEntry | null): Promise<void> {
  try {
    if (entry) await AsyncStorage.setItem(cacheKey(uid), JSON.stringify(entry));
    else await AsyncStorage.removeItem(cacheKey(uid));
  } catch (e) {
    console.warn('[terms] cache write failed:', e);
  }
}

// true — сервер записал согласие. Любая ошибка (сеть, таймаут, PT404…) → false.
async function sendAcceptance(): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
  try {
    const { error } = await supabase
      .rpc('accept_terms', { p_version: TERMS_VERSION })
      .abortSignal(ctrl.signal);
    if (error) {
      console.warn('[terms] accept_terms failed:', error.code, error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('[terms] accept_terms exception:', e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

interface TermsConsentApi {
  ensureAccepted: () => Promise<boolean>;
}

const TermsConsentContext = createContext<TermsConsentApi | null>(null);

export function TermsConsentProvider({ children }: { children: ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [requested, setRequested] = useState(false); // кто-то ждёт ensureAccepted
  const [busy, setBusy] = useState(false);

  const uidRef = useRef<string | null>(null);
  const statusRef = useRef<Status>('idle');
  const waitersRef = useRef<Array<(ok: boolean) => void>>([]);
  statusRef.current = status;

  const settleWaiters = useCallback((ok: boolean) => {
    const waiters = waitersRef.current;
    waitersRef.current = [];
    setRequested(false);
    waiters.forEach((resolve) => resolve(ok));
  }, []);

  // ── Кто вошёл. setUid с тем же id не перерисовывает → TOKEN_REFRESHED no-op.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUid(session?.user?.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUid(session?.user?.id ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // ── Статус согласия для текущего uid.
  useEffect(() => {
    uidRef.current = uid;
    if (!uid) {
      setStatus('idle');
      settleWaiters(false);
      return;
    }
    setStatus('loading');
    const isStale = () => uidRef.current !== uid;

    (async () => {
      const cached = await readCache(uid);
      if (isStale()) return;
      const cachedOk = cached?.version === TERMS_VERSION;
      if (cachedOk) setStatus('accepted'); // сразу, без мигания экрана

      // Принял офлайн в прошлый раз → доотправляем; БД при этом не читаем:
      // локальное согласие засчитано, а там его ещё нет по определению.
      if (cachedOk && cached!.pending) {
        if (await sendAcceptance()) await writeCache(uid, { version: TERMS_VERSION, pending: false });
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('terms_accepted_at, terms_version')
        .eq('id', uid)
        .maybeSingle();
      if (isStale()) return;
      if (error) {
        console.warn('[terms] profile read failed:', error.message);
        if (!cachedOk) setStatus('unknown');
        return;
      }
      const dbOk = !!data?.terms_accepted_at && data.terms_version === TERMS_VERSION;
      if (dbOk) {
        setStatus('accepted');
        if (!cachedOk) await writeCache(uid, { version: TERMS_VERSION, pending: false });
      } else {
        // БД — источник правды: нет согласия с текущей версией → спрашиваем.
        setStatus('needed');
        if (cached) await writeCache(uid, null);
      }
    })();
  }, [uid, settleWaiters]);

  // Статус стал «принято» (кнопкой или догрузкой из БД) → отпускаем ждущих.
  useEffect(() => {
    if (status === 'accepted' && waitersRef.current.length > 0) settleWaiters(true);
  }, [status, settleWaiters]);

  const ensureAccepted = useCallback((): Promise<boolean> => {
    if (!uidRef.current || statusRef.current === 'accepted') return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      waitersRef.current.push(resolve);
      setRequested(true);
    });
  }, []);

  async function handleAccept() {
    const current = uidRef.current;
    if (busy || !current) return;
    setBusy(true);
    const sent = await sendAcceptance();
    await writeCache(current, { version: TERMS_VERSION, pending: !sent });
    setBusy(false);
    if (uidRef.current === current) setStatus('accepted');
  }

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    settleWaiters(false);
    // Без сети глобальный signOut возвращает ошибку и сессию НЕ снимает —
    // тогда выходим локально, чтобы «Выйти» работал всегда.
    const { error } = await supabase.auth.signOut();
    if (error) await supabase.auth.signOut({ scope: 'local' });
    await clearLocalUserData(); // как обычный выход в ProfileScreen
    if (navigationRef.isReady()) {
      navigationRef.reset({ index: 0, routes: [{ name: 'Main' as never }] });
    }
    setBusy(false);
  }

  const api = useMemo(() => ({ ensureAccepted }), [ensureAccepted]);
  const visible = !!uid && status !== 'accepted' && (status === 'needed' || requested);

  return (
    <TermsConsentContext.Provider value={api}>
      {children}
      {visible && (
        <TermsConsentScreen busy={busy} onAccept={handleAccept} onSignOut={handleSignOut} />
      )}
    </TermsConsentContext.Provider>
  );
}

export function useTermsConsent(): TermsConsentApi {
  const ctx = useContext(TermsConsentContext);
  if (!ctx) throw new Error('useTermsConsent must be used inside TermsConsentProvider');
  return ctx;
}
