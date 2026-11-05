 import { useState, useCallback, useRef } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 
 // Simple cache to avoid re-translating the same text
 const translationCache = new Map<string, string>();
 
 // Check if a string contains Hindi/Devanagari characters
 export const containsHindi = (text: string): boolean => {
   // Devanagari Unicode range: 0900-097F
   return /[\u0900-\u097F]/.test(text);
 };
 
 // Batch translate multiple texts from Hindi to English
 export const translateTextsToEnglish = async (texts: string[]): Promise<Map<string, string>> => {
   const result = new Map<string, string>();
   const textsToTranslate: string[] = [];
   
   // Check cache first
   texts.forEach(text => {
     if (translationCache.has(text)) {
       result.set(text, translationCache.get(text)!);
     } else if (containsHindi(text)) {
       textsToTranslate.push(text);
     } else {
       // No Hindi text, use as-is
       result.set(text, text);
     }
   });
   
   if (textsToTranslate.length === 0) {
     return result;
   }
   
   try {
     const { data, error } = await supabase.functions.invoke('translate-address', {
       body: { addresses: textsToTranslate }
     });
     
     if (error) {
       console.error('Translation error:', error);
       // Fallback: use original texts
       textsToTranslate.forEach(text => result.set(text, text));
       return result;
     }
     
     const translatedAddresses = data?.translatedAddresses || [];
     textsToTranslate.forEach((original, index) => {
       const translated = translatedAddresses[index] || original;
       translationCache.set(original, translated);
       result.set(original, translated);
     });
     
     return result;
   } catch (error) {
     console.error('Translation error:', error);
     // Fallback: use original texts
     textsToTranslate.forEach(text => result.set(text, text));
     return result;
   }
 };
 
 // Hook to manage translations for a list of items
 export const useHindiToEnglish = () => {
   const [translations, setTranslations] = useState<Map<string, string>>(new Map());
   const [isTranslating, setIsTranslating] = useState(false);
   const pendingTextsRef = useRef<Set<string>>(new Set());
   
   const translateTexts = useCallback(async (texts: string[]) => {
     // Filter out already translated texts
     const newTexts = texts.filter(t => !translations.has(t) && !pendingTextsRef.current.has(t));
     
     if (newTexts.length === 0) return;
     
     // Mark as pending
     newTexts.forEach(t => pendingTextsRef.current.add(t));
     
     setIsTranslating(true);
     try {
       const newTranslations = await translateTextsToEnglish(newTexts);
       
       setTranslations(prev => {
         const updated = new Map(prev);
         newTranslations.forEach((value, key) => {
           updated.set(key, value);
         });
         return updated;
       });
     } finally {
       newTexts.forEach(t => pendingTextsRef.current.delete(t));
       setIsTranslating(false);
     }
   }, [translations]);
   
   const getTranslated = useCallback((text: string): string => {
     return translations.get(text) || text;
   }, [translations]);
   
   return {
     translateTexts,
     getTranslated,
     isTranslating,
     translations
   };
 };