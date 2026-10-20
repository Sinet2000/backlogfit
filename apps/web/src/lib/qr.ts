import qrcode from 'qrcode-generator';

export interface QrMatrix {
  size: number;
  /** SVG path data with one 1×1 square per dark module (no inline styles, no data: URLs). */
  path: string;
}

/** Encode text (ASCII URLs) as a QR code. Error correction M survives a slightly blurry screen. */
export function qrMatrix(text: string, level: 'L' | 'M' | 'Q' | 'H' = 'M'): QrMatrix {
  const qr = qrcode(0, level);
  qr.addData(text, 'Byte');
  qr.make();
  const size = qr.getModuleCount();
  let path = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    }
  }
  return { size, path };
}
