export class ImageCache {
  #images = new Map();
  constructor(loaded, createImage = () => new Image()) {
    Object.assign(this, { loaded, createImage });
  }
  get(src) {
    if (!src) return null;
    if (!this.#images.has(src)) {
      const image = this.createImage();
      image.onload = this.loaded;
      image.onerror = () => {
        image.failed = true;
      };
      image.src = src;
      this.#images.set(src, image);
    }
    const image = this.#images.get(src);
    return image.complete && image.naturalWidth && !image.failed ? image : null;
  }
}
