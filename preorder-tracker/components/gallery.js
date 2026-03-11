export function ImageGallery(images = []) {
  if (!images.length) return `<p class="meta">No images yet.</p>`;
  return `<div class="gallery">${images.map((src) => `<img src="${src}" alt="product image" />`).join("")}</div>`;
}
