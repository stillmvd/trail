const FULL_SIDE = 2560;
const THUMB_W = 640;
const THUMB_H = 400;
const LADDER = [0.88, 0.94, 0.98];
const LOSSLESS = 1;
const THUMB_QUALITY = 0.8;
const MIN_PSNR = 40;
const KEEP_RATIO = 0.9;

export type EncodeRequest = { id: number; blob: Blob; thumbOnly?: boolean };
export type EncodeResult = {
  id: number;
  full: Blob | null;
  thumb: Blob | null;
  width: number;
  height: number;
  psnr: number | null;
  error?: string;
};

function draw(src: ImageBitmap, w: number, h: number) {
  const c = new OffscreenCanvas(w, h);
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, w, h);
  return c;
}

const pixels = (c: OffscreenCanvas) => c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;

async function decodePixels(blob: Blob, w: number, h: number) {
  const b = await createImageBitmap(blob);
  try {
    const c = new OffscreenCanvas(w, h);
    c.getContext("2d")!.drawImage(b, 0, 0);
    return pixels(c);
  } finally {
    b.close();
  }
}

function psnr(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  let s = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    const w = a[i + 3] / 255;
    if (!w) continue;
    for (let j = 0; j < 3; j++) s += w * (a[i + j] - b[i + j]) ** 2;
    n += 3 * w;
  }
  if (!n || !s) return 99;
  return 10 * Math.log10((255 * 255) / (s / n));
}

async function encode({ id, blob, thumbOnly }: EncodeRequest): Promise<EncodeResult> {
  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    const tk = Math.min(1, Math.max(THUMB_W / bmp.width, THUMB_H / bmp.height));
    const thumb = await draw(bmp, Math.round(bmp.width * tk), Math.round(bmp.height * tk)).convertToBlob({
      type: "image/webp",
      quality: THUMB_QUALITY,
    });
    if (thumbOnly) return { id, full: null, thumb, width: bmp.width, height: bmp.height, psnr: null };

    const k = Math.min(1, FULL_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = draw(bmp, Math.round(bmp.width * k), Math.round(bmp.height * k));
    const ref = pixels(canvas);
    let full: Blob | null = null;
    let score = 0;
    for (const q of LADDER) {
      const b = await canvas.convertToBlob({ type: "image/webp", quality: q });
      if (b.size >= blob.size * KEEP_RATIO) break;
      score = psnr(ref, await decodePixels(b, canvas.width, canvas.height));
      if (score >= MIN_PSNR) {
        full = b;
        break;
      }
    }
    if (!full) {
      const b = await canvas.convertToBlob({ type: "image/webp", quality: LOSSLESS });
      if (b.size < blob.size * KEEP_RATIO) {
        full = b;
        score = psnr(ref, await decodePixels(b, canvas.width, canvas.height));
      }
    }
    return { id, full, thumb, width: bmp.width, height: bmp.height, psnr: full ? score : null };
  } finally {
    bmp.close();
  }
}

const post = (m: EncodeResult) => (self as unknown as { postMessage(m: EncodeResult): void }).postMessage(m);

self.onmessage = async (e: MessageEvent<EncodeRequest>) => {
  try {
    post(await encode(e.data));
  } catch (err) {
    post({ id: e.data.id, full: null, thumb: null, width: 0, height: 0, psnr: null, error: String(err) });
  }
};
