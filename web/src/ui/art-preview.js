const boundsCache = new Map();

// Measure transparency once per source, using a small sample. Map sprites retain
// their native geometry; only gallery artwork gets an equal visual footprint.
function bounds(image) {
  if (boundsCache.has(image.src)) return boundsCache.get(image.src);
  try {
    const canvas = document.createElement("canvas");
    const size = 96;
    canvas.width = canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, size, size);
    const data = context.getImageData(0, 0, size, size).data;
    let left = size,
      top = size,
      right = 0,
      bottom = 0;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (data[(y * size + x) * 4 + 3] < 24) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x + 1);
        bottom = Math.max(bottom, y + 1);
      }
    const result =
      right > left && bottom > top
        ? {
            left: left / size,
            top: top / size,
            width: (right - left) / size,
            height: (bottom - top) / size,
          }
        : { left: 0, top: 0, width: 1, height: 1 };
    boundsCache.set(image.src, result);
    return result;
  } catch {
    return { left: 0, top: 0, width: 1, height: 1 };
  }
}

export function artPreview(src, alt = "") {
  const stage = document.createElement("span");
  stage.className = "art-preview";
  const image = document.createElement("img");
  image.alt = alt;
  image.loading = "lazy";
  image.onload = () => {
    const box = bounds(image);
    const ratio = image.naturalWidth / image.naturalHeight;
    const height = Math.min(100 / box.height, 116 / (box.width * ratio));
    const width = height * ratio;
    image.style.width = `${(width / 140) * 100}%`;
    image.style.height = `${(height / 124) * 100}%`;
    image.style.left = `${(((140 - width * box.width) / 2 - width * box.left) / 140) * 100}%`;
    image.style.top = `${((112 - height * (box.top + box.height)) / 124) * 100}%`;
    stage.classList.add("art-ready");
  };
  image.src = src;
  stage.append(image);
  return stage;
}
