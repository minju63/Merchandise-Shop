import { useEffect, useState } from 'react';
import { showcaseApi } from '../../api/showcase.api.js';

const GALLERY_MEDIA_TTL = 60_000;
const GALLERY_MEDIA_LIMIT = 24 * 1024 * 1024;
const galleryMedia = new Map();
let galleryMediaBytes = 0;

function removeGalleryMedia(src, entry) {
  if (galleryMedia.get(src) !== entry) return;
  galleryMedia.delete(src);
  galleryMediaBytes -= entry.blob?.size ?? 0;
  clearTimeout(entry.timer);
}

function galleryImage(src) {
  const cached = galleryMedia.get(src);
  if (cached) {
    galleryMedia.delete(src);
    galleryMedia.set(src, cached);
    return cached.promise;
  }

  const entry = { blob: null, timer: null, promise: null };
  entry.promise = showcaseApi.image(src).then((blob) => {
    if (galleryMedia.get(src) !== entry) return blob;
    if (blob.size > GALLERY_MEDIA_LIMIT) {
      removeGalleryMedia(src, entry);
      return blob;
    }
    entry.blob = blob;
    galleryMediaBytes += blob.size;
    while (galleryMediaBytes > GALLERY_MEDIA_LIMIT) {
      const oldest = galleryMedia.keys().next().value;
      removeGalleryMedia(oldest, galleryMedia.get(oldest));
    }
    entry.timer = setTimeout(() => removeGalleryMedia(src, entry), GALLERY_MEDIA_TTL);
    return blob;
  }).catch((error) => {
    removeGalleryMedia(src, entry);
    throw error;
  });
  galleryMedia.set(src, entry);
  return entry.promise;
}

export default function ShowcaseImage({ src, alt = '', cacheMedia = false, ...props }) {
  const [loaded, setLoaded] = useState(null);
  const privateImage = src?.startsWith('/api/v1/showcases/');
  useEffect(() => {
    if (!privateImage) return undefined;
    let active = true;
    let objectUrl;
    (cacheMedia ? galleryImage(src) : showcaseApi.image(src)).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setLoaded({ src, url: objectUrl });
      else URL.revokeObjectURL(objectUrl);
    }).catch(() => { if (active) setLoaded({ src, url: null }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, privateImage, cacheMedia]);
  const displayUrl = privateImage ? loaded?.src === src && loaded.url : src;
  return displayUrl ? <img src={displayUrl} alt={alt} {...props} /> : <span className="showcase-image-fallback" aria-label={alt || '이미지 없음'} />;
}
