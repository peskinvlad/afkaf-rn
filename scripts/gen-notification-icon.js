/*
 * gen-notification-icon.js — Android notification small-icon из монохромной
 * иконки лончера.
 *
 * ЗАЧЕМ: статус-бар Android рисует small-icon ТОЛЬКО по альфа-маске (цвет
 * игнорируется, тон задаёт notification color). Без своей иконки expo берёт
 * app icon → белый квадрат. Берём готовый одноцветный силуэт
 * assets/android-icon-monochrome.png (знак «^» afkaf на прозрачном фоне),
 * обрезаем прозрачные поля, перекрашиваем в белый (на всякий случай — важна
 * альфа) и вписываем ~80% кадра в прозрачный холст 96×96.
 *
 * ЗАВИСИМОСТИ: только devDependency @napi-rs/canvas (как gen-marker-pngs.ts).
 * ЗАПУСК:  node scripts/gen-notification-icon.js
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const SRC = path.join(__dirname, '..', 'assets', 'android-icon-monochrome.png');
const OUT = path.join(__dirname, '..', 'assets', 'notification-icon.png');
const SIZE = 96;        // итоговый кадр (px)
const FILL = 0.8;       // доля кадра под силуэт по большей стороне
const ALPHA_MIN = 16;   // порог «непрозрачного» пикселя для bbox

async function main() {
  const img = await loadImage(SRC);

  // На временный холст по натуральному размеру, читаем пиксели.
  const w = img.width;
  const h = img.height;
  const probe = createCanvas(w, h);
  const pctx = probe.getContext('2d');
  pctx.drawImage(img, 0, 0, w, h);
  const data = pctx.getImageData(0, 0, w, h).data;

  // bbox непрозрачных пикселей.
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > ALPHA_MIN) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('Источник полностью прозрачный — нечего обрезать.');
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;

  // Перекрашиваем обрезанный силуэт в белый, сохраняя альфу.
  const crop = createCanvas(bw, bh);
  const cctx = crop.getContext('2d');
  cctx.drawImage(probe, minX, minY, bw, bh, 0, 0, bw, bh);
  const cimg = cctx.getImageData(0, 0, bw, bh);
  for (let i = 0; i < cimg.data.length; i += 4) {
    cimg.data[i] = 255;
    cimg.data[i + 1] = 255;
    cimg.data[i + 2] = 255;
  }
  cctx.putImageData(cimg, 0, 0);

  // Вписываем в SIZE×SIZE так, чтобы большая сторона = FILL*SIZE, по центру.
  const target = Math.round(SIZE * FILL);
  const scale = target / Math.max(bw, bh);
  const dw = Math.round(bw * scale);
  const dh = Math.round(bh * scale);
  const dx = Math.round((SIZE - dw) / 2);
  const dy = Math.round((SIZE - dh) / 2);

  const out = createCanvas(SIZE, SIZE);
  const octx = out.getContext('2d');
  octx.clearRect(0, 0, SIZE, SIZE);
  octx.drawImage(crop, 0, 0, bw, bh, dx, dy, dw, dh);

  fs.writeFileSync(OUT, out.toBuffer('image/png'));
  console.log(
    `notification-icon.png: ${SIZE}x${SIZE}, силуэт ${dw}x${dh} ` +
      `(из bbox ${bw}x${bh} источника ${w}x${h}), поля ${dx}/${dy}px.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
