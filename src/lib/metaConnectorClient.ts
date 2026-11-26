import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
export async function metaConnectorRequest<T = any>(body: Record<string, unknown>): Promise<T> {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in to continue.');
  if ((session.expires_at ?? 0) * 1000 < Date.now() + 60000) {
    const renewed = await supabase.auth.refreshSession();
    if (renewed.error || !renewed.data.session) throw new Error('Sign in again to continue.');
    session = renewed.data.session;
  }
  const invoke = () => supabase.functions.invoke('meta-ads-connector', { body, headers: { Authorization: `Bearer ${session.access_token}` } });
  let result = await invoke();
  if (result.error instanceof FunctionsHttpError && result.error.context.status === 401) {
    const renewed = await supabase.auth.refreshSession();
    if (renewed.data.session) { session = renewed.data.session; result = await invoke(); }
  }
  if (result.error) {
    if (result.error instanceof FunctionsHttpError) {
      const text = await result.error.context.text();
      try {
        const detail = JSON.parse(text);
        let provider = detail.details;
        if (typeof provider === 'string') { try { provider = JSON.parse(provider); } catch { /* retain plain text */ } }
        throw new Error(provider?.error?.error_user_msg || provider?.error?.message || detail.error || text);
      } catch (e) { if (e instanceof SyntaxError) throw new Error(text); throw e; }
    }
    throw result.error;
  }
  if (result.data?.error) throw new Error(result.data.error);
  return result.data as T;
}
export function saveConnectorDraft(userId: string, value: unknown): Promise<void> {
  return draftStore(userId, value).then(() => undefined);
}
export function readConnectorDraft(userId: string): Promise<any> { return draftStore(userId); }
function draftStore(userId: string, value?: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('meta-connector-drafts', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('drafts');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('drafts', value === undefined ? 'readonly' : 'readwrite');
      const request = value === undefined ? tx.objectStore('drafts').get(userId) : tx.objectStore('drafts').put(value, userId);
      let result: unknown;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => { db.close(); resolve(result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}
