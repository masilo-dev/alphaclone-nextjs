/**
 * Browser-only helpers for the signature image the owner adopts.
 *
 * The saved signature is stored *clean* (just the strokes). Each time it is
 * applied to a contract we stamp the signer's name and today's date onto a
 * copy, so a reused signature never carries a stale date.
 */

export interface SignatureStampOptions {
  fullName: string;
  date?: Date;
  locale?: string;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Saved signature image could not be loaded'));
    img.src = dataUrl;
  });
}

/** Draw the "Signed by" + date footer used on every adopted signature. */
export function stampSignatureCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  { fullName, date = new Date(), locale }: SignatureStampOptions,
): void {
  ctx.font = '14px Arial';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';
  ctx.fillText(`Signed by: ${fullName}`, width - 10, height - 10);
  ctx.textAlign = 'left';
  ctx.fillText(date.toLocaleDateString(locale), 10, height - 10);
}

/** Produce a stamped PNG data URL from a clean saved signature. */
export async function stampSavedSignature(cleanDataUrl: string, options: SignatureStampOptions): Promise<string> {
  const img = await loadImage(cleanDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width || 600;
  canvas.height = img.naturalHeight || img.height || 240;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  stampSignatureCanvas(ctx, canvas.width, canvas.height, options);
  return canvas.toDataURL('image/png', 1.0);
}
