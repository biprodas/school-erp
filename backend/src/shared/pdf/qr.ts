import QRCode from 'qrcode';

/** An inline SVG QR code for PDF templates (`{{{qr}}}`). */
export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    margin: 0,
    errorCorrectionLevel: 'M',
  });
}
