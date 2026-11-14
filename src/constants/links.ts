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
} as const;
