import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { comparePngs } from './pixels.mjs';

function png(width, height, paint = () => [255, 255, 255, 255]) {
  const img = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = paint(x, y);
      img.data.set([r, g, b, a], (y * width + x) * 4);
    }
  }
  return PNG.sync.write(img);
}

test('identical images differ in no pixel', () => {
  assert.deepEqual(comparePngs(png(20, 10), png(20, 10)), {
    width: 20, height: 10, sizeChanged: false, diffPixels: 0, diffPercent: 0, box: null,
  });
});

test('changed pixels are counted, with the box that holds them', () => {
  const b = png(20, 10, (x, y) => (x >= 4 && x < 8 && y >= 2 && y < 5 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
  const out = comparePngs(png(20, 10), b);
  assert.equal(out.diffPixels, 12);
  assert.equal(out.diffPercent, 6);
  assert.deepEqual(out.box, { x: 4, y: 2, width: 4, height: 3 });
});

test('a difference too small to see is not counted at the default threshold', () => {
  const b = png(20, 10, () => [253, 254, 255, 255]);
  assert.equal(comparePngs(png(20, 10), b).diffPixels, 0);
  assert.ok(comparePngs(png(20, 10), b, { threshold: 0 }).diffPixels > 0);
});

test('images of different sizes are compared on the larger canvas, and the size change is reported', () => {
  const out = comparePngs(png(20, 10), png(20, 14));
  assert.equal(out.sizeChanged, true);
  assert.equal(out.width, 20);
  assert.equal(out.height, 14);
  assert.equal(out.diffPixels, 80, 'the four extra rows count as changed');
});
