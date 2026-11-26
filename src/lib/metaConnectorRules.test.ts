import { describe, expect, it } from 'vitest';
import { CONNECTOR_DEFAULTS, websiteDestination } from './metaConnectorRules';
import { campaignPayload as connectorCampaignPayload } from '../../supabase/functions/meta-ads-connector/rules';
describe('connector campaign choices', () => {
  it('creates a separately named campaign for each request without a reusable campaign ID', () => {
    expect(connectorCampaignPayload('Launch One', [])).toMatchObject({ name: 'Launch One', status: 'PAUSED' });
    expect(connectorCampaignPayload('Launch Two', [])).toMatchObject({ name: 'Launch Two' });
    expect(connectorCampaignPayload('Launch Two', [])).not.toHaveProperty('campaign_id');
  });
  it('defaults to a website destination and website CTA', () => {
    expect(CONNECTOR_DEFAULTS.destination).toBe('website');
    expect(CONNECTOR_DEFAULTS.cta).toBe('LEARN_MORE');
    expect(websiteDestination('https://example.com/shop')).toBe('https://example.com/shop');
    expect(() => websiteDestination('javascript:alert(1)')).toThrow();
  });
});