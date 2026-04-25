function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo procesar la imagen."));
    image.src = src;
  });
}

function drawContain(ctx, image, width, height) {
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = Math.round(image.width * scale);
  const drawHeight = Math.round(image.height * scale);
  const x = Math.round((width - drawWidth) / 2);
  const y = Math.round((height - drawHeight) / 2);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

async function resizeImageToPngDataUrl(source, width, height) {
  const image = await loadImage(source);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  drawContain(context, image, width, height);
  return canvas.toDataURL("image/png");
}

export async function buildBrandingAssetSet(file) {
  const logoOriginal = await readFileAsDataUrl(file);
  const [logoHeader, logoIcon32, logoIcon192, logoIcon512] = await Promise.all([
    resizeImageToPngDataUrl(logoOriginal, 240, 72),
    resizeImageToPngDataUrl(logoOriginal, 32, 32),
    resizeImageToPngDataUrl(logoOriginal, 192, 192),
    resizeImageToPngDataUrl(logoOriginal, 512, 512),
  ]);

  return {
    logoOriginal,
    logoHeader,
    logoIcon32,
    logoIcon192,
    logoIcon512,
  };
}
