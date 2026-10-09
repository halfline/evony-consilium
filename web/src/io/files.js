const SPRITE_BYTES = 4500000;

export async function decodeImage(file, maxBytes = SPRITE_BYTES) {
  if (!file || !["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Choose a PNG, JPEG, or WebP image.");
  if (file.size > maxBytes)
    throw new Error(
      "Image is too large. Use an image under " +
        Math.round(maxBytes / 1000000) +
        " MB.",
    );
  const src = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const im = new Image();
  im.src = src;
  await im.decode();
  if (im.naturalWidth > 10000 || im.naturalHeight > 10000)
    throw new Error("Image dimensions must be under 10,000 pixels.");
  return im;
}

export async function readImage(file, maxBytes = SPRITE_BYTES) {
  const image = await decodeImage(file, maxBytes);
  return {
    src: image.src,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}
