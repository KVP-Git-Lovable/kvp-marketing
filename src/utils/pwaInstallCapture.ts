// Global capture for beforeinstallprompt event
// This runs immediately when the module is loaded, before React mounts

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Store the event globally so it's not lost if the hook mounts late
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let promptCaptured = false;

// Capture the event as early as possible
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    console.log('🔧 beforeinstallprompt captured globally');
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    promptCaptured = true;
    
    // Dispatch a custom event so React components can react
    window.dispatchEvent(new CustomEvent('pwa-prompt-ready'));
  });
}

export const getDeferredPrompt = (): BeforeInstallPromptEvent | null => {
  return deferredInstallPrompt;
};

export const clearDeferredPrompt = (): void => {
  deferredInstallPrompt = null;
};

export const wasPromptCaptured = (): boolean => {
  return promptCaptured;
};

export type { BeforeInstallPromptEvent };
