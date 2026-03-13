export function ImageGallery(images = []) {
  if (!images.length) return `<p class="meta">尚未上傳圖片。</p>`;
  return `<div class="gallery">${images.map((src) => `<img src="${src}" alt="商品圖片" />`).join("")}</div>`;
}
