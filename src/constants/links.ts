// Единый источник URL публичных документов afkaf (хостинг на Netlify).
// Меняется здесь — меняется во всех экранах (AboutScreen, AuthScreen).
//
// Форма URL проверена `curl -sIL` 2026-11-14: /privacy, /terms и
// /delete-account отдают 200 и реальную страницу документа (а не главную —
// <title> соответствует), без редиректа. Берём «чистую» форму без «.html»:
// работает одинаково, короче в UI.
const SITE = 'https://afkaf.netlify.app';

export const LINKS = {
  privacy: `${SITE}/privacy`,
  terms: `${SITE}/terms`,
  deleteAccount: `${SITE}/delete-account`,
  // Support URL для App Store Connect: контакты + ссылки на документы (web/support.html).
  support: `${SITE}/support`,
} as const;

// Версия условий использования, которую человек принимает на TermsConsentScreen
// (пишется в profiles.terms_version через RPC accept_terms, ≤ 20 символов).
// Существенно изменили /terms → поднять версию: все примут условия заново.
export const TERMS_VERSION = '2026-11';
