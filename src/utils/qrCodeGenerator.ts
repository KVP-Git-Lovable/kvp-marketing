import QRCode from 'qrcode';

export interface ProductQRData {
  id: string;
  sku: string;
  name: string;
  category?: string;
  rate: number;
  unit: string;
  barcode?: string;
  is_focused_product?: boolean;
}

export const generateProductQRCode = async (productData: ProductQRData): Promise<string> => {
  try {
    const qrData = JSON.stringify({
      type: 'product',
      id: productData.id,
      sku: productData.sku,
      name: productData.name,
      category: productData.category,
      rate: productData.rate,
      unit: productData.unit,
      barcode: productData.barcode,
      is_focused: productData.is_focused_product,
      timestamp: new Date().toISOString()
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

export const parseProductQRCode = (qrCodeData: string): ProductQRData | null => {
  try {
    const parsed = JSON.parse(qrCodeData);
    if (parsed.type === 'product') {
      return {
        id: parsed.id,
        sku: parsed.sku,
        name: parsed.name,
        category: parsed.category,
        rate: parsed.rate,
        unit: parsed.unit,
        barcode: parsed.barcode,
        is_focused_product: parsed.is_focused
      };
    }
    return null;
  } catch (error) {
    console.error('Error parsing QR code:', error);
    return null;
  }
};
