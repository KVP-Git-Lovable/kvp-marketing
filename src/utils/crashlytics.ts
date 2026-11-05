import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Custom Capacitor 7 plugin bridge for Firebase Crashlytics.
 * 
 * The native Android side must register a plugin named "FirebaseCrashlyticsPlugin"
 * that implements these methods. Crashlytics is configured entirely in native
 * Gradle files (android/build.gradle & android/app/build.gradle).
 * 
 * No @capacitor-community/firebase-crashlytics dependency is used.
 */

interface FirebaseCrashlyticsPlugin {
  setEnabled(options: { enabled: boolean }): Promise<void>;
  log(options: { message: string }): Promise<void>;
  setUserId(options: { userId: string }): Promise<void>;
  recordException(options: { message: string; domain?: string; code?: number }): Promise<void>;
  crash(options: { message: string }): Promise<void>;
}

const FirebaseCrashlytics = registerPlugin<FirebaseCrashlyticsPlugin>('FirebaseCrashlyticsPlugin');

let initialized = false;

export async function initCrashlytics(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('⚠️ Crashlytics: Skipping on web platform');
    return;
  }

  try {
    await FirebaseCrashlytics.setEnabled({ enabled: true });
    initialized = true;
    console.log('✅ Firebase Crashlytics initialized');
  } catch (error) {
    console.warn('⚠️ Firebase Crashlytics init failed:', error);
  }
}

export async function logCrashlytics(message: string): Promise<void> {
  if (!initialized) return;
  try {
    await FirebaseCrashlytics.log({ message });
  } catch (e) {
    console.warn('Crashlytics log failed:', e);
  }
}

export async function setCrashlyticsUser(userId: string): Promise<void> {
  if (!initialized) return;
  try {
    await FirebaseCrashlytics.setUserId({ userId });
  } catch (e) {
    console.warn('Crashlytics setUserId failed:', e);
  }
}

export async function recordCrashlyticsError(message: string, domain?: string, code?: number): Promise<void> {
  if (!initialized) return;
  try {
    await FirebaseCrashlytics.recordException({
      message,
      domain: domain || 'app',
      code: code || 0,
    });
  } catch (e) {
    console.warn('Crashlytics recordException failed:', e);
  }
}

export async function testCrash(): Promise<void> {
  if (!initialized) {
    console.warn('Crashlytics not available — cannot test crash');
    return;
  }
  await FirebaseCrashlytics.crash({ message: 'Test crash from app' });
}
