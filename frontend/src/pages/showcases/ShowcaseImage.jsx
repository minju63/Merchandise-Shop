import { useEffect, useState } from 'react';
import { showcaseApi } from '../../api/showcase.api.js';

export default function ShowcaseImage({ src, alt = '', ...props }) {
  const [loaded, setLoaded] = useState(null);
  const privateImage = src?.startsWith('/api/v1/showcases/');
  useEffect(() => {
    if (!privateImage) return undefined;
    let active = true;
    let objectUrl;
    showcaseApi.image(src).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setLoaded({ src, url: objectUrl });
    }).catch(() => { if (active) setLoaded({ src, url: null }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [src, privateImage]);
  const displayUrl = privateImage ? loaded?.src === src && loaded.url : src;
  return displayUrl ? <img src={displayUrl} alt={alt} {...props} /> : <span className="showcase-image-fallback" aria-label={alt || '이미지 없음'} />;
}
