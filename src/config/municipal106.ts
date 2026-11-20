// Горячие линии мэрий («106») для кнопки «Сообщить в мэрию».
// Номера проверены по официальным сайтам мэрий 20.11.2026, перепроверять раз в полгода.
// whatsapp — формат wa.me (только цифры, с кодом страны, без «+»); '' = канала нет.
// phone — обычный номер для tel:; '' = канала нет. Порядок каналов: whatsapp → phone.
// НЕ править номера «на глаз» — только по сайту мэрии.
import type { CityId } from '../lib/municipality';

export interface Municipal106Contact {
  whatsapp: string;
  phone: string;
  verifiedAt?: string;
}

export const MUNICIPAL_106: Record<CityId, Municipal106Contact> = {
  tel_aviv_yafo: { whatsapp: '972521208239', phone: '035238888', verifiedAt: '2026-11-20' },
  holon: { whatsapp: '97235011111', phone: '035011111', verifiedAt: '2026-11-20' },
  rishon_lezion: { whatsapp: '972545546763', phone: '039542799', verifiedAt: '2026-11-20' },
  givatayim: { whatsapp: '972542524913', phone: '037336600', verifiedAt: '2026-11-20' },
  ramat_hasharon: { whatsapp: '972525559106', phone: '035483800', verifiedAt: '2026-11-20' },
  herzliya: { whatsapp: '972536106106', phone: '099591520', verifiedAt: '2026-11-20' },
  bat_yam: { whatsapp: '', phone: '' },
  bnei_brak: { whatsapp: '', phone: '037712900' },
  ramat_gan: { whatsapp: '', phone: '' },
};
