import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE задан явно, а не оставлен на дефолт библиотеки. На мобильном
    // редирект приходит на кастомную схему afkaf://, которую может
    // зарегистрировать любое приложение. При implicit-флоу в этом редиректе
    // едут сами токены — перехватчик получает готовую сессию. При PKCE едет
    // одноразовый code, бесполезный без code_verifier: тот генерируется здесь
    // же, лежит в этом storage и никогда не покидает устройство.
    flowType: 'pkce',
  },
});
