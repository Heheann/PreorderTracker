import { escapeHtml } from "./uiKit.js";

export function ImageGallery(images = []) {
  if (!images.length) return `<p class="meta">尚未新增圖片</p>`;

  return `<div class="gallery">${images
    .map((src, index) => `<img src="${escapeHtml(src)}" alt="商品圖片 ${index + 1}" loading="lazy" />`)
    .join("")}</div>`;
}