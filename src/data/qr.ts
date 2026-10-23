/** QR code as SVG markup. The QR library loads on first use, not with the page. */
export async function qrSvg(url: string): Promise<string> {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#0a0d0b', light: '#ffffff' } });
}
