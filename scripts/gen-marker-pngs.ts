/**
 * gen-marker-pngs.ts — генератор PNG-маркеров для Android-карты.
 *
 * ЗАЧЕМ: react-native-maps@1.20.1 на New Architecture (Fabric) рисует
 * children-View маркеры в заниженный bitmap → пин обрезается (см.
 * docs/ANDROID-TODO.md, «Обрезка кастомных маркеров»). JS-обхода нет.
 * Решение (вариант «г»): на Android отдавать статичным пинам готовые PNG через
 * проп <Marker image={...}>. iOS остаётся на View-детях, байт в байт.
 *
 * ЧТО ДЕЛАЕТ: рисует диск (цвет пина + белая/зелёная обводка) и кладёт сверху
 * emoji из шрифта Noto Emoji (Google, Android-родной). Сохраняет PNG в
 * assets/markers/ в пяти плотностях (@1x/@1.5x/@2x/@3x/@4x — вёдра Android
 * ldpi/mdpi..xxxhdpi; Metro сам подберёт нужную по require). Прозрачный фон с
 * запасом по краям, якорь по центру (anchor 0.5/0.5).
 *
 * ИСТОЧНИКИ ДАННЫХ (единый, не дублируем руками):
 *   - цвета/emoji типов — src/lib/markerConfig.ts (MARKER_CONFIG);
 *   - аватары друзей — DOG_ICONS ниже, зеркалит src/screens/DogProfileScreen.tsx
 *     (там RN-импорты, из node не подтянуть; при правке синхронизировать).
 *
 * ЗАВИСИМОСТИ: только devDependency @napi-rs/canvas (prebuilt, без нативной
 * сборки). Emoji-PNG (Noto, 512px) тянутся с jsdelivr и кэшируются в
 * scripts/.emoji-cache/ (в git не идёт). В приложение шрифт/кэш не попадают —
 * это build-time-инструмент.
 *
 * ЗАПУСК:  node scripts/gen-marker-pngs.ts
 *          node scripts/gen-marker-pngs.ts --sheet-only   (только контактный лист)
 */

import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D, type Image } from '@napi-rs/canvas';
import { MARKER_CONFIG } from '../src/lib/markerConfig.ts';
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'markers');
// Ручные подмены глифа: если есть assets/markers/src/<type>.svg — на диск кладём
// его, а не emoji из Noto. Нужно, когда Noto-глиф читается неоднозначно (напр.
// 🎾 у Noto — ракетка с мячом, dog_park превращается в «теннисный корт»).
const SRC_DIR = join(OUT_DIR, 'src');
const CACHE_DIR = join(ROOT, 'scripts', '.emoji-cache');
const SHEET_PATH = join(ROOT, 'docs', 'marker-sheet.png');

// Android density buckets → Metro suffix. @1x = base name без суффикса.
const SCALES: { scale: number; suffix: string }[] = [
  { scale: 1, suffix: '' },
  { scale: 1.5, suffix: '@1.5x' },
  { scale: 2, suffix: '@2x' },
  { scale: 3, suffix: '@3x' },
  { scale: 4, suffix: '@4x' },
];

// ── Геометрия (логические px, как у нынешнего MapMarkerIcon) ──────────────────
// touch/root 44, диск 38, обводка 2 (белая) — MapMarkerIcon.
// Друзья: диск 38, обводка 3 (зелёная #2c5f25), белый фон — FriendWalkerMarker.
// Своя позиция: панцирь 48 (UserLocationMarker), тип-капля смотрит строго вверх.
const BOX = 44;                 // корневой бокс метки типа/друга
const DISC = 38;                // диаметр диска
const DISC_R = DISC / 2;        // 19
const MARKER_BORDER = 2;        // белая обводка диска метки
const FRIEND_BORDER = 3;        // зелёное кольцо друга
const FRIEND_RING = '#2c5f25';  // brand green
const EMOJI_DISC = 22;          // визуальный размер emoji на диске (fontSize 18 в RN + запас)

const USER_BOX = 48;            // UserLocationMarker SIZE
const USER_R = 17;              // радиус панциря капли
const USER_INNER_R = 13;        // белое ядро
const USER_GREEN = '#2c5f25';
const PAW_EMOJI = 16;           // 🐾 fontSize 14 в RN + запас

const PAD = 3;                  // прозрачный запас по краям (тень/обводка не режутся)

// Аватары собак — зеркало DOG_ICONS из DogProfileScreen.tsx (8 шт). Слаг —
// человекочитаемое имя файла friend-<slug>.png; по emoji строится Noto-имя.
const DOG_ICONS: { emoji: string; slug: string }[] = [
  { emoji: '🐕', slug: 'dog' },
  { emoji: '🐩', slug: 'poodle' },
  { emoji: '🐶', slug: 'dogface' },
  { emoji: '🦮', slug: 'guidedog' },
  { emoji: '🐕‍🦺', slug: 'servicedog' },
  { emoji: '🐾', slug: 'pawprints' },
  { emoji: '🦴', slug: 'bone' },
  { emoji: '🐺', slug: 'wolf' },
];

// ── Noto Emoji: имя файла по emoji и загрузка (с кэшем) ───────────────────────
// Noto опускает VS-16 (U+FE0F), ZWJ (U+200D) сохраняет. Файлы 2D/png/512.
const NOTO_BASE = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-emoji@main/2D/png/512';

function notoFileName(emoji: string): string {
  const cps = [...emoji]
    .map((ch) => ch.codePointAt(0)!.toString(16))
    .filter((hex) => hex !== 'fe0f'); // variation selector-16 не входит в имя
  return `emoji_u${cps.join('_')}.png`;
}

const emojiCache = new Map<string, Image>();

async function loadEmoji(emoji: string): Promise<Image> {
  const cached = emojiCache.get(emoji);
  if (cached) return cached;

  const file = notoFileName(emoji);
  const localPath = join(CACHE_DIR, file);
  let bytes: Buffer;
  if (existsSync(localPath)) {
    bytes = await readFile(localPath);
  } else {
    const url = `${NOTO_BASE}/${file}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Noto emoji fetch failed ${res.status}: ${url}`);
    bytes = Buffer.from(await res.arrayBuffer());
    await writeFile(localPath, bytes);
  }
  const img = await loadImage(bytes);
  emojiCache.set(emoji, img);
  return img;
}

// Глиф для типа метки: SVG-подмена (assets/markers/src/<type>.svg) при наличии,
// иначе emoji из Noto. Размер/центрирование те же (EMOJI_DISC).
async function loadTypeGlyph(type: string, emoji: string): Promise<Image> {
  const svgPath = join(SRC_DIR, `${type}.svg`);
  if (existsSync(svgPath)) {
    const key = `svg:${type}`;
    const cached = emojiCache.get(key);
    if (cached) return cached;
    const img = await loadImage(await readFile(svgPath));
    emojiCache.set(key, img);
    return img;
  }
  return loadEmoji(emoji);
}

// Рисует emoji, вписанный в квадрат target×target с центром в (cx, cy).
function drawEmoji(ctx: SKRSContext2D, img: Image, cx: number, cy: number, target: number) {
  ctx.drawImage(img, cx - target / 2, cy - target / 2, target, target);
}

function fillCircle(ctx: SKRSContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

// Создаёт canvas в логическом размере `logical`, но с pixel-scale `scale`.
// Всё рисование — в логических координатах (ctx.scale делает пересчёт).
function makeCanvas(logical: number, scale: number) {
  const px = Math.round(logical * scale);
  const canvas = createCanvas(px, px);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  return { canvas, ctx };
}

// ── Рисовалки одного маркера (в логических координатах, центр = logical/2) ─────

async function drawTypeMarker(ctx: SKRSContext2D, center: number, type: string, emoji: string, color: string) {
  fillCircle(ctx, center, center, DISC_R, '#ffffff');                 // белая обводка
  fillCircle(ctx, center, center, DISC_R - MARKER_BORDER, color);     // цветное тело
  drawEmoji(ctx, await loadTypeGlyph(type, emoji), center, center, EMOJI_DISC);
}

async function drawFriendMarker(ctx: SKRSContext2D, center: number, emoji: string) {
  fillCircle(ctx, center, center, DISC_R, FRIEND_RING);              // зелёное кольцо
  fillCircle(ctx, center, center, DISC_R - FRIEND_BORDER, '#ffffff'); // белый фон
  drawEmoji(ctx, await loadEmoji(emoji), center, center, EMOJI_DISC);
}

// Капля-стрелка «смотрит вверх» (heading 0 = север). Форма как SHELL_PATH в
// UserLocationMarker: круг r17 + треугольный носик, основание на краю круга.
function drawUserArrow(ctx: SKRSContext2D, center: number) {
  const cx = center;
  const cy = center;
  // Базовые точки носика в координатах UserLocationMarker (viewBox 0..48):
  //   tip (24,2), left (18,8), right (30,8). Пересчитываем к центру `center`.
  const dx = center - USER_BOX / 2; // сдвиг из системы 0..48 в систему PAD-бокса
  const P = (x: number, y: number) => [x + dx, y + dx] as const;
  const [tipX, tipY] = P(24, 2);
  const [lX, lY] = P(18, 8);
  const [rX, rY] = P(30, 8);

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(lX, lY);
  // дуга по нижним ~320° круга: large-arc, против часовой на экране
  ctx.arc(cx, cy, USER_R, Math.atan2(lY - cy, lX - cx), Math.atan2(rY - cy, rX - cx), true);
  ctx.lineTo(tipX, tipY);
  ctx.closePath();
  ctx.fillStyle = USER_GREEN;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();

  // белое ядро (вращение на круге незаметно — паву рисуем отдельным маркером)
  fillCircle(ctx, cx, cy, USER_INNER_R, '#ffffff');
}

async function drawPaw(ctx: SKRSContext2D, center: number) {
  drawEmoji(ctx, await loadEmoji('🐾'), center, center, PAW_EMOJI);
}

// ── Запись одного маркера во всех плотностях ──────────────────────────────────
type DrawFn = (ctx: SKRSContext2D, center: number) => void | Promise<void>;

async function emit(name: string, logicalBox: number, draw: DrawFn) {
  const logical = logicalBox + PAD * 2; // прозрачный запас со всех сторон
  const center = logical / 2;
  for (const { scale, suffix } of SCALES) {
    const { canvas, ctx } = makeCanvas(logical, scale);
    await draw(ctx, center);
    const png = canvas.toBuffer('image/png');
    await writeFile(join(OUT_DIR, `${name}${suffix}.png`), png);
  }
}

// ── Контактный лист docs/marker-sheet.png ─────────────────────────────────────
type SheetItem = { label: string; name: string };

async function buildSheet(items: { section: string; entries: SheetItem[] }[]) {
  // регистрируем системный шрифт для подписей
  for (const p of [
    '/System/Library/Fonts/Supplemental/Arial.ttf',
    '/System/Library/Fonts/SFNSDisplay.ttf',
    '/Library/Fonts/Arial.ttf',
  ]) {
    if (existsSync(p)) { GlobalFonts.registerFromPath(p, 'Sheet'); break; }
  }

  const CELL = 84;         // клетка под маркер
  const LABEL_W = 150;
  const ROW_H = CELL + 8;
  const GAP = 12;
  const HEADER_H = 34;
  const PADDING = 24;
  const cols = LABEL_W + CELL + GAP + CELL; // label | light | dark

  const totalRows = items.reduce((n, s) => n + s.entries.length, 0);
  const width = PADDING * 2 + cols;
  const height =
    PADDING * 2 +
    items.length * HEADER_H +
    totalRows * ROW_H +
    (items.length - 1) * GAP;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e9edf2';
  ctx.fillRect(0, 0, width, height);

  let y = PADDING;
  for (const section of items) {
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 20px Sheet';
    ctx.textBaseline = 'middle';
    ctx.fillText(section.section, PADDING, y + HEADER_H / 2);
    y += HEADER_H;

    for (const entry of section.entries) {
      const rowY = y;
      // label
      ctx.fillStyle = '#374151';
      ctx.font = '15px Sheet';
      ctx.textBaseline = 'middle';
      ctx.fillText(entry.label, PADDING, rowY + ROW_H / 2);

      const img = await loadImage(join(OUT_DIR, `${entry.name}@3x.png`));
      const size = Math.min(CELL - 8, Math.max(img.width, img.height));
      const drawOne = (cellX: number, bg: string) => {
        ctx.fillStyle = bg;
        ctx.fillRect(cellX, rowY, CELL, CELL);
        ctx.drawImage(
          img,
          cellX + (CELL - size) / 2,
          rowY + (CELL - size) / 2,
          size,
          size,
        );
      };
      const lightX = PADDING + LABEL_W;
      const darkX = lightX + CELL + GAP;
      drawOne(lightX, '#f8fafc'); // светлый фон (карта днём)
      drawOne(darkX, '#243447');  // тёмный фон
      y += ROW_H;
    }
    y += GAP;
  }

  await writeFile(SHEET_PATH, canvas.toBuffer('image/png'));
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const sheetOnly = process.argv.includes('--sheet-only');
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(CACHE_DIR, { recursive: true });
  await mkdir(dirname(SHEET_PATH), { recursive: true });

  const typeEntries: SheetItem[] = [];
  const friendEntries: SheetItem[] = [];
  const selfEntries: SheetItem[] = [];

  if (!sheetOnly) {
    // Типы меток (все из MARKER_CONFIG, включая water/park/dog_park).
    for (const [type, cfg] of Object.entries(MARKER_CONFIG)) {
      const name = `marker-${type}`;
      await emit(name, BOX, (ctx, c) => drawTypeMarker(ctx, c, type, cfg.emoji, cfg.pinColor));
      const src = existsSync(join(SRC_DIR, `${type}.svg`)) ? '  (SVG override)' : '';
      console.log(`  ${name}  ${cfg.emoji}  ${cfg.pinColor}${src}`);
    }
    // Пины друзей (8 аватаров в зелёном кольце).
    for (const { emoji, slug } of DOG_ICONS) {
      const name = `friend-${slug}`;
      await emit(name, BOX, (ctx, c) => drawFriendMarker(ctx, c, emoji));
      console.log(`  ${name}  ${emoji}`);
    }
    // Своя позиция: стрелка (вращается нативно) + пава (статична) — отдельно.
    await emit('user-arrow', USER_BOX, (ctx, c) => drawUserArrow(ctx, c));
    await emit('user-paw', USER_BOX, (ctx, c) => drawPaw(ctx, c));
    console.log('  user-arrow  (стрелка вверх, для нативного rotation)');
    console.log('  user-paw    🐾 (статичная поверх стрелки)');
  }

  for (const type of Object.keys(MARKER_CONFIG)) {
    typeEntries.push({ label: type, name: `marker-${type}` });
  }
  for (const { slug } of DOG_ICONS) {
    friendEntries.push({ label: slug, name: `friend-${slug}` });
  }
  selfEntries.push({ label: 'user-arrow', name: 'user-arrow' });
  selfEntries.push({ label: 'user-paw', name: 'user-paw' });

  await buildSheet([
    { section: 'Типы меток (marker-*)', entries: typeEntries },
    { section: 'Пины друзей (friend-*)', entries: friendEntries },
    { section: 'Своя позиция (user-*)', entries: selfEntries },
  ]);
  console.log(`\nКонтактный лист: ${SHEET_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
