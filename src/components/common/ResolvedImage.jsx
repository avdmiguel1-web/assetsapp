import { useEffect, useState } from "react";

const imageCache = new Map();

function isFetchable(src = "") {
  return /^https?:\/\//i.test(src) || src.startsWith("/");
}

async function resolveImageUrl(src) {
  if (!src || !isFetchable(src)) return src;
  if (imageCache.has(src)) return imageCache.get(src);

  const response = await fetch(src);
  if (!response.ok) throw new Error(`Image request failed with ${response.status}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  imageCache.set(src, objectUrl);
  return objectUrl;
}

export default function ResolvedImage({ src, alternateSrc = "", alt = "", fallback = null, ...props }) {
  const [resolvedSrc, setResolvedSrc] = useState(() => (src && !isFetchable(src) ? src : ""));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!src) {
      setResolvedSrc("");
      setFailed(false);
      return undefined;
    }

    if (!isFetchable(src)) {
      setResolvedSrc(src);
      setFailed(false);
      return undefined;
    }

    setResolvedSrc("");
    setFailed(false);

    resolveImageUrl(src)
      .then((nextUrl) => {
        if (!cancelled) setResolvedSrc(nextUrl);
      })
      .catch(() => {
        if (!cancelled) {
          if (alternateSrc && alternateSrc !== src) {
            setResolvedSrc(alternateSrc);
            setFailed(false);
            return;
          }
          setResolvedSrc("");
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [alternateSrc, src]);

  if (!src || failed || !resolvedSrc) return fallback;
  return <img src={resolvedSrc} alt={alt} {...props} />;
}
