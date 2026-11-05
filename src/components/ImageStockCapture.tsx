import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Check, Edit2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface DetectedProduct {
  productId: string;
  productName: string;
  sku: string;
  count: number;
  confidence: number;
}

interface ImageStockCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (stockCounts: { productId: string; productName: string; count: number }[]) => void;
}

export const ImageStockCapture: React.FC<ImageStockCaptureProps> = ({
  isOpen,
  onClose,
  onApprove,
}) => {
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [detectedProducts, setDetectedProducts] = useState<DetectedProduct[]>([]);
  const [showReview, setShowReview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newImages: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      await new Promise((resolve) => {
        reader.onload = (event) => {
          if (event.target?.result) {
            newImages.push(event.target.result as string);
          }
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    }

    setCapturedImages(prev => [...prev, ...newImages]);
    toast({
      title: 'Images Added',
      description: `Added ${newImages.length} image(s)`,
    });
  };

  const removeImage = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  const analyzeImages = async () => {
    if (capturedImages.length === 0) {
      toast({
        title: 'No Images',
        description: 'Please capture or upload at least one image',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      // Fetch all active products with SKU images from product management
      // This ensures we always get the latest uploaded images
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, sku_image_url')
        .eq('is_active', true)
        .not('sku_image_url', 'is', null)
        .order('updated_at', { ascending: false }); // Get latest updates first

      if (productsError) {
        console.error('Error fetching products:', productsError);
        throw productsError;
      }

      if (!products || products.length === 0) {
        toast({
          title: 'No Product Images',
          description: 'Please add SKU images to products in Product Management first',
          variant: 'destructive',
        });
        setIsAnalyzing(false);
        return;
      }

      console.log('Fetched products with images:', products.map(p => ({
        name: p.name,
        sku: p.sku,
        hasImage: !!p.sku_image_url,
        imageUrl: p.sku_image_url
      })));

      const productSkuImages = products.map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        imageUrl: p.sku_image_url,
      }));

      console.log('Starting analysis with', productSkuImages.length, 'product reference images');

      // Call the edge function with captured shelf images and product reference images
      const { data, error } = await supabase.functions.invoke('analyze-stock-images', {
        body: {
          images: capturedImages,
          productSkuImages,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      console.log('Analysis result:', data);

      if (data.success && data.detectedProducts) {
        setDetectedProducts(data.detectedProducts);
        setShowReview(true);
        toast({
          title: 'Analysis Complete',
          description: data.message || `Detected ${data.detectedProducts.length} product(s)`,
        });
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Error analyzing images:', error);
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze images',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateProductCount = (productId: string, newCount: number) => {
    setDetectedProducts(prev =>
      prev.map(p => p.productId === productId ? { ...p, count: Math.max(0, newCount) } : p)
    );
  };

  const handleApprove = () => {
    const stockCounts = detectedProducts
      .filter(p => p.count > 0)
      .map(p => ({
        productId: p.productId,
        productName: p.productName, // Include product name for better matching
        count: p.count,
      }));

    if (stockCounts.length === 0) {
      toast({
        title: 'No Products Selected',
        description: 'Please ensure at least one product has a count greater than 0',
        variant: 'destructive',
      });
      return;
    }

    onApprove(stockCounts);
    handleReset();
  };

  const handleReset = () => {
    setCapturedImages([]);
    setDetectedProducts([]);
    setShowReview(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showReview ? 'Review Detected Stock' : 'Capture Product Images'}
          </DialogTitle>
          <DialogDescription>
            {showReview
              ? 'Review and adjust the detected product counts before applying them'
              : 'Take or upload multiple photos of products on retailer shelves for automatic stock counting'}
          </DialogDescription>
        </DialogHeader>

        {!showReview ? (
          <div className="space-y-4">
            {/* Image capture section */}
            <div className="flex gap-2">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="flex-1"
              >
                <Camera className="mr-2 h-4 w-4" />
                Capture / Upload Images
              </Button>
              {capturedImages.length > 0 && (
                <Button
                  onClick={analyzeImages}
                  disabled={isAnalyzing}
                  variant="default"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Analyze Images'
                  )}
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={handleImageCapture}
              className="hidden"
            />

            {/* Captured images grid */}
            {capturedImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {capturedImages.map((image, index) => (
                  <Card key={index} className="relative p-2">
                    <img
                      src={image}
                      alt={`Captured ${index + 1}`}
                      className="w-full h-40 object-cover rounded"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute top-3 right-3"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}

            {capturedImages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Upload className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No images captured yet</p>
                <p className="text-sm">Click the button above to add images</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Detected products review */}
            {detectedProducts.length > 0 ? (
              <div className="space-y-3">
                {detectedProducts.map((product) => (
                  <Card key={product.productId} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{product.productName}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {product.sku}
                          </Badge>
                          <Badge 
                            variant={product.confidence > 0.8 ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {Math.round(product.confidence * 100)}% confidence
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateProductCount(product.productId, product.count - 1)}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          value={product.count}
                          onChange={(e) => updateProductCount(product.productId, parseInt(e.target.value) || 0)}
                          className="w-20 text-center"
                          min="0"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateProductCount(product.productId, product.count + 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No products detected in the images</p>
                <p className="text-sm">Try capturing clearer images or ensure products have reference SKU images</p>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowReview(false)} className="flex-1">
                Back to Images
              </Button>
              <Button onClick={handleApprove} className="flex-1" disabled={detectedProducts.length === 0}>
                <Check className="mr-2 h-4 w-4" />
                Apply Stock Counts
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};