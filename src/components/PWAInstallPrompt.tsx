import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, X, RefreshCw, Share, MoreVertical, Smartphone } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { checkForUpdates, forceRefresh } from "@/utils/cacheUtils";

export const PWAInstallPrompt = () => {
  const { isInstallable, installApp, canPrompt, handleDismiss, getPlatformInfo } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [showManualInstructions, setShowManualInstructions] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // Check for updates on component mount
    checkForUpdates().then(setHasUpdate);
  }, []);

  const handleInstallClick = async () => {
    setIsInstalling(true);
    
    const result = await installApp();
    
    if (result.success) {
      setIsDismissed(true);
    } else if (result.method === 'manual') {
      // Show platform-specific manual instructions
      setShowManualInstructions(true);
    }
    
    setIsInstalling(false);
  };

  const handleLocalDismiss = () => {
    handleDismiss();
    setIsDismissed(true);
  };

  const handleForceRefresh = () => {
    forceRefresh();
  };

  // Show update prompt if there's an update available
  if (hasUpdate) {
    return (
      <Card className="fixed bottom-4 left-4 right-4 z-50 shadow-lg border-orange-500/20 bg-background/95 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-base">Update Available</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHasUpdate(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            A new version is available with the latest updates
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex space-x-2">
            <Button onClick={handleForceRefresh} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Update Now
            </Button>
            <Button variant="outline" onClick={() => setHasUpdate(false)}>
              Later
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show manual installation instructions
  if (showManualInstructions) {
    const platformInfo = getPlatformInfo();
    
    return (
      <Card className="fixed bottom-4 left-4 right-4 z-50 shadow-lg border-primary/20 bg-background/95 backdrop-blur-sm max-h-[80vh] overflow-y-auto">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Install QuickApp.ai</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowManualInstructions(false);
                setIsDismissed(true);
              }}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          {platformInfo.isIOS ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Follow these steps to install on your iPhone/iPad:
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</div>
                  <div className="text-sm">
                    <span className="font-medium">Tap the Share button</span>
                    <Share className="inline-block w-4 h-4 mx-1 text-primary" />
                    at the bottom of Safari
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</div>
                  <div className="text-sm">Scroll down and tap <span className="font-medium">"Add to Home Screen"</span></div>
                </div>
                <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</div>
                  <div className="text-sm">Tap <span className="font-medium">"Add"</span> to confirm</div>
                </div>
              </div>
            </div>
          ) : platformInfo.isAndroid ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Follow these steps to install on your Android device:
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</div>
                  <div className="text-sm">
                    <span className="font-medium">Tap the menu</span>
                    <MoreVertical className="inline-block w-4 h-4 mx-1 text-primary" />
                    (three dots) in your browser
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</div>
                  <div className="text-sm">
                    {platformInfo.isChrome ? (
                      <>Look for <span className="font-medium">"Install app"</span> or <span className="font-medium">"Add to Home screen"</span></>
                    ) : platformInfo.isSamsungBrowser ? (
                      <>Tap <span className="font-medium">"Add page to"</span> then <span className="font-medium">"Home screen"</span></>
                    ) : (
                      <>Look for <span className="font-medium">"Install"</span> or <span className="font-medium">"Add to Home screen"</span></>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">3</div>
                  <div className="text-sm">Follow the prompts to install</div>
                </div>
              </div>
              {!platformInfo.isChrome && (
                <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                  💡 Tip: For the best experience, open this page in Chrome browser
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Follow these steps to install on your computer:
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">1</div>
                  <div className="text-sm">Look for the <span className="font-medium">install icon</span> <Download className="inline-block w-4 h-4 mx-1 text-primary" /> in your address bar</div>
                </div>
                <div className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">2</div>
                  <div className="text-sm">Or click the browser menu and select <span className="font-medium">"Install QuickApp.ai"</span></div>
                </div>
              </div>
            </div>
          )}
          
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => {
              setShowManualInstructions(false);
              setIsDismissed(true);
            }}
          >
            Got it
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isInstallable || isDismissed) {
    return null;
  }

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 shadow-lg border-primary/20 bg-background/95 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Download className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Install App</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLocalDismiss}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Install QuickApp.ai for a better experience
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex space-x-2">
          <Button onClick={handleInstallClick} className="flex-1" disabled={isInstalling}>
            {isInstalling ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Installing...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Install Now
              </>
            )}
          </Button>
          <Button variant="outline" onClick={handleLocalDismiss}>
            Maybe Later
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};