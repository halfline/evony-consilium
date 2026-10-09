import test from "node:test";
import assert from "node:assert/strict";
import { ImageCache } from "../web/src/rendering/image-cache.js";

test("image loading is shared and notifies only when pixels become available", () => {
  const images = [];
  let redraws = 0;
  const cache = new ImageCache(
    () => redraws++,
    () => {
      const image = { complete: false, naturalWidth: 0 };
      images.push(image);
      return image;
    },
  );
  assert.equal(cache.get("castle.webp"), null);
  assert.equal(cache.get("castle.webp"), null);
  assert.equal(images.length, 1);
  Object.assign(images[0], { complete: true, naturalWidth: 200 });
  images[0].onload();
  assert.equal(cache.get("castle.webp"), images[0]);
  assert.equal(redraws, 1);
  assert.equal(cache.get(""), null);
});

test("failed images do not repeatedly start requests or enter painting", () => {
  let requests = 0;
  const image = { complete: true, naturalWidth: 0 };
  const cache = new ImageCache(
    () => assert.fail("Failed image requested a redraw"),
    () => {
      requests++;
      return image;
    },
  );
  cache.get("missing.webp");
  image.onerror();
  assert.equal(cache.get("missing.webp"), null);
  assert.equal(requests, 1);
});
