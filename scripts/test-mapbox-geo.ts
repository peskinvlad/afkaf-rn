// Смоук-тест чистой геометрии экранов на Mapbox: npx tsx scripts/test-mapbox-geo.ts
import { haversine } from '../src/lib/geo';
import {
  circlePolygon, clampToRadius, metersPerPoint, metersToPoints, trackBounds, trackLine,
} from '../src/lib/mapboxGeo';

let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
}
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const BAT_YAM = { latitude: 32.0174, longitude: 34.7455 };

// 1. Масштаб: зум 14 у Mapbox = «зум 15» старого кода (≈4,05 м в точке на 32°).
const mpp14 = metersPerPoint(32.0559, 14);
check('метров в точке на зуме 14', near(mpp14, 4.05, 0.03), mpp14.toFixed(3));
check('каждый зум вдвое', near(metersPerPoint(32, 15) * 2, metersPerPoint(32, 14), 1e-9));
check('круг 500 м на зуме 14 влезает в экран 430 pt', metersToPoints(500, 32.0559, 14) < 215, metersToPoints(500, 32.0559, 14).toFixed(1));
check('круг 150 м на зуме 14,9 влезает в карту 204 pt', metersToPoints(150, 32.0174, 14.9) * 2 < 204, (metersToPoints(150, 32.0174, 14.9) * 2).toFixed(1));

// 2. Круг: все вершины на заданном расстоянии, кольцо замкнуто.
const ring = circlePolygon(BAT_YAM, 150).geometry.coordinates[0];
const dists = ring.map(([lng, lat]) => haversine(BAT_YAM, { latitude: lat, longitude: lng }) * 1000);
check('круг 150 м: вершины в пределах ±1 м', dists.every((d) => near(d, 150, 1)), `${Math.min(...dists).toFixed(2)}…${Math.max(...dists).toFixed(2)}`);
check('круг замкнут', ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]);
check('круг: 65 точек', ring.length === 65);

// 3. Возврат в круг.
const far = { latitude: BAT_YAM.latitude + 0.004, longitude: BAT_YAM.longitude + 0.003 };
const farM = haversine(BAT_YAM, far) * 1000;
const snapped = clampToRadius(BAT_YAM, far, farM, 150);
const snappedM = haversine(BAT_YAM, snapped) * 1000;
check('точка снаружи встаёт на край', near(snappedM, 150, 0.5), snappedM.toFixed(2));
check('точка на краю повторно не двигается (допуск 1 м)', snappedM <= 151);
const inside = { latitude: BAT_YAM.latitude + 0.0005, longitude: BAT_YAM.longitude };
check('точка внутри не трогается', clampToRadius(BAT_YAM, inside, haversine(BAT_YAM, inside) * 1000, 150) === inside);
check('нулевое расстояние не делит на ноль', clampToRadius(BAT_YAM, BAT_YAM, 0, 150) === BAT_YAM);

// 4. Трек.
check('пустой трек → нет линии', trackLine([]) === null);
check('одна точка → нет линии', trackLine([BAT_YAM]) === null);
check('битые точки выброшены', trackLine([BAT_YAM, { latitude: NaN, longitude: 1 }, { latitude: 0, longitude: 0 }, far])?.geometry.coordinates.length === 2);
check('пустой трек → нет рамки', trackBounds([]) === null);
const b1 = trackBounds([BAT_YAM, BAT_YAM])!;
const spanLat = haversine({ latitude: b1.sw[1], longitude: b1.sw[0] }, { latitude: b1.ne[1], longitude: b1.sw[0] }) * 1000;
const spanLng = haversine({ latitude: b1.sw[1], longitude: b1.sw[0] }, { latitude: b1.sw[1], longitude: b1.ne[0] }) * 1000;
check('вырожденный трек расширен до ~120 м', near(spanLat, 120, 2) && near(spanLng, 120, 2), `${spanLat.toFixed(1)} × ${spanLng.toFixed(1)}`);
const b2 = trackBounds([BAT_YAM, far])!;
check('рамка: ne больше sw', b2.ne[0] > b2.sw[0] && b2.ne[1] > b2.sw[1]);
check('рамка охватывает обе точки', b2.sw[0] <= BAT_YAM.longitude && b2.ne[0] >= far.longitude && b2.sw[1] <= BAT_YAM.latitude && b2.ne[1] >= far.latitude);

console.log(failed ? `\nПРОВАЛЕНО: ${failed}` : '\nвсё прошло');
process.exit(failed ? 1 : 0);
