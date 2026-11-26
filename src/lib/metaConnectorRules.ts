export const CONNECTOR_DEFAULTS = { destination: 'website', cta: 'LEARN_MORE', objective: 'OUTCOME_TRAFFIC', optimization: 'LINK_CLICKS', status: 'PAUSED' } as const;
export function websiteDestination(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Enter a public HTTPS website URL.');
  return url.toString();
}