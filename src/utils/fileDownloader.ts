import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { LocalNotifications } from '@capacitor/local-notifications';
import { toast } from 'sonner';

/**
 * Cross-platform file downloader that works in both native APK and web/PWA
 * Uses Capacitor Filesystem API for native apps, falls back to browser download for web
 */

export interface DownloadOptions {
  filename: string;
  mimeType: string;
  blob?: Blob;
  base64Data?: string;
  showToast?: boolean;
}
/**
 * Show download notification in Android notification bar
 * This is wrapped in try-catch to never break the download flow
 */
const showDownloadNotification = async (filename: string, fileUri: string, success: boolean) => {
  // Always wrap in try-catch - notification should never break download
  try {
    if (!Capacitor.isNativePlatform()) return;
    
    // Request permission first
    const permResult = await LocalNotifications.checkPermissions();
    if (permResult.display !== 'granted') {
      const reqResult = await LocalNotifications.requestPermissions();
      if (reqResult.display !== 'granted') {
        console.log('Notification permission not granted');
        return;
      }
    }

    const notificationId = Date.now() % 2147483647; // Ensure valid int32

    if (success) {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: 'Download Complete',
            body: `${filename} saved successfully`,
            channelId: 'downloads',
          }
        ]
      });
    } else {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: 'Download Failed',
            body: `Failed to save ${filename}`,
            channelId: 'downloads'
          }
        ]
      });
    }
  } catch (error) {
    // Silently log - never let notification break download flow
    console.log('Notification skipped:', error);
  }
};

/**
 * Initialize notification channel for downloads (call once on app start)
 */
export const initDownloadNotifications = async () => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    await LocalNotifications.createChannel({
      id: 'downloads',
      name: 'Downloads',
      description: 'File download notifications',
      importance: 4, // High importance
      visibility: 1, // Public
      sound: 'default',
      vibration: true
    });

    console.log('✅ Download notification channel created');
  } catch (error) {
    console.log('Failed to create notification channel:', error);
  }
};

/**
 * Downloads a file - uses native filesystem on Android/iOS, browser download on web
 */
export const downloadFile = async (options: DownloadOptions): Promise<boolean> => {
  const { filename, mimeType, blob, base64Data, showToast = true } = options;

  console.log('📥 Download requested:', { filename, mimeType, isNative: Capacitor.isNativePlatform() });

  try {
    // Check if running in native app
    if (Capacitor.isNativePlatform()) {
      return await downloadNative(filename, mimeType, blob, base64Data, showToast);
    } else {
      return await downloadWeb(filename, mimeType, blob, base64Data, showToast);
    }
  } catch (error) {
    console.error('Download error:', error);
    if (showToast) {
      toast.error('Failed to download file');
    }
    return false;
  }
};

/**
 * Native download using Capacitor Filesystem - saves to accessible location
 */
const downloadNative = async (
  filename: string,
  mimeType: string,
  blob?: Blob,
  base64Data?: string,
  showToast = true
): Promise<boolean> => {
  try {
    console.log('📱 Native download starting for:', filename);
    
    // Convert blob to base64 if needed
    let data = base64Data;
    if (blob && !data) {
      console.log('Converting blob to base64...');
      data = await blobToBase64(blob);
    }

    if (!data) {
      throw new Error('No data to save');
    }

    // Remove data URL prefix if present
    if (data.includes(',')) {
      data = data.split(',')[1];
    }

    console.log('Base64 data length:', data.length);

    // Directory priority for Android visibility:
    // 1. Documents - universally accessible and visible in file managers
    // 2. ExternalStorage/Download - requires WRITE_EXTERNAL_STORAGE permission
    // 3. Data - app-specific, less visible but always works
    
    const directories = [
      { dir: Directory.Documents, name: 'Documents', path: filename },
      { dir: Directory.ExternalStorage, name: 'ExternalStorage/Download', path: `Download/${filename}` },
      { dir: Directory.Data, name: 'Data', path: filename },
    ];

    let savedUri = '';
    let savedLocation = '';

    for (const { dir, name, path } of directories) {
      try {
        console.log(`Trying to save to ${name}...`);
        
        const result = await Filesystem.writeFile({
          path: path,
          data: data,
          directory: dir,
          recursive: true,
        });
        
        console.log(`✅ File saved to ${name}:`, result.uri);
        savedUri = result.uri;
        savedLocation = name;
        break;
      } catch (dirError: any) {
        console.log(`❌ ${name} failed:`, dirError.message);
        continue;
      }
    }

    if (savedUri) {
      if (showToast) {
        toast.success(`Saved to ${savedLocation}: ${filename}`, {
          duration: 5000,
          action: {
            label: 'OK',
            onClick: () => {}
          }
        });
      }
      
      // Show notification in notification bar
      await showDownloadNotification(filename, savedUri, true);
      return true;
    } else {
      throw new Error('All directory attempts failed');
    }
  } catch (error: any) {
    console.error('❌ Native download error:', error);
    if (showToast) {
      toast.error(`Failed to save: ${error.message || 'Unknown error'}`);
    }
    
    // Show failure notification
    await showDownloadNotification(filename, '', false);
    
    return false;
  }
};

/**
 * Web download using blob URL and anchor element
 */
const downloadWeb = async (
  filename: string,
  mimeType: string,
  blob?: Blob,
  base64Data?: string,
  showToast = true
): Promise<boolean> => {
  try {
    console.log('🌐 Web download starting for:', filename);
    
    let downloadBlob = blob;
    
    // Convert base64 to blob if needed
    if (!downloadBlob && base64Data) {
      downloadBlob = base64ToBlob(base64Data, mimeType);
    }

    if (!downloadBlob) {
      throw new Error('No data to download');
    }

    const url = URL.createObjectURL(downloadBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('✅ Web download triggered');

    if (showToast) {
      toast.success(`Downloaded: ${filename}`);
    }
    
    return true;
  } catch (error) {
    console.error('Web download error:', error);
    if (showToast) {
      toast.error('Failed to download file');
    }
    return false;
  }
};

/**
 * Convert Blob to base64 string
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Convert base64 string to Blob
 */
export const base64ToBlob = (base64: string, mimeType: string): Blob => {
  // Remove data URL prefix if present
  let data = base64;
  if (data.includes(',')) {
    data = data.split(',')[1];
  }
  
  const byteCharacters = atob(data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

/**
 * Download PDF file
 */
export const downloadPDF = async (blob: Blob, filename: string): Promise<boolean> => {
  console.log('📄 downloadPDF called:', filename, 'Blob size:', blob?.size);
  
  if (!blob || blob.size === 0) {
    console.error('PDF blob is empty or undefined');
    toast.error('PDF generation failed - no data');
    return false;
  }
  
  try {
    return await downloadFile({
      filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`,
      mimeType: 'application/pdf',
      blob,
    });
  } catch (error: any) {
    console.error('downloadPDF error:', error);
    toast.error(`PDF download error: ${error.message || 'Unknown'}`);
    return false;
  }
};

/**
 * Download Excel file (for XLSX library)
 * XLSX.write returns a buffer, convert it to Blob first
 */
export const downloadExcel = async (
  workbook: any, 
  filename: string,
  XLSX: any
): Promise<boolean> => {
  try {
    console.log('📊 downloadExcel called:', filename);
    
    // Write workbook to array buffer
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    console.log('Excel blob created, size:', blob.size);
    
    return downloadFile({
      filename: filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      blob,
    });
  } catch (error) {
    console.error('Excel download error:', error);
    toast.error('Failed to download Excel file');
    return false;
  }
};

/**
 * Download CSV file
 */
export const downloadCSV = async (csvContent: string, filename: string): Promise<boolean> => {
  console.log('📋 downloadCSV called:', filename);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  
  return downloadFile({
    filename: filename.endsWith('.csv') ? filename : `${filename}.csv`,
    mimeType: 'text/csv',
    blob,
  });
};
