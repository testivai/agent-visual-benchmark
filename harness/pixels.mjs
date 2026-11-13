// Pixel comparison of two PNG screenshots. Used to record whether a seeded
// defect shows in a screenshot at all. It is never used to score a task.
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

function onCanvas(img, width, height) {
  if (img.width === width && img.height === height) return img.data;
  // transparent padding: every padded pixel differs from the other image's opaque pixel
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < img.height; y++) {
    img.data.copy(data, y * width * 4, y * img.width * 4, (y + 1) * img.width * 4);
  }
  return data;
}

function boxOf(diff, width, height) {
  let minX = width; let minY = height; let maxX = -1; let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // pixelmatch paints differing pixels red (255, 0, 0)
      if (diff[i] === 255 && diff[i + 1] === 0 && diff[i + 2] === 0) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      }
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// threshold 0.2 is Playwright's default for toHaveScreenshot().
export function comparePngs(bufferA, bufferB, { threshold = 0.2 } = {}) {
  const a = PNG.sync.read(bufferA);
  const b = PNG.sync.read(bufferB);
  const width = Math.max(a.width, b.width);
  const height = Math.max(a.height, b.height);
  const diff = Buffer.alloc(width * height * 4);
  const diffPixels = pixelmatch(onCanvas(a, width, height), onCanvas(b, width, height), diff, width, height, {
    threshold, includeAA: true, diffColor: [255, 0, 0], alpha: 0,
  });
  return {
    width,
    height,
    sizeChanged: a.width !== b.width || a.height !== b.height,
    diffPixels,
    diffPercent: Math.round((diffPixels / (width * height)) * 10000) / 100,
    box: boxOf(diff, width, height),
  };
}
