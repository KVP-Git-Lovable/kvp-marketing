import { describe, expect, it } from 'vitest';
import { csvCell, mapAudienceSheet, usableRows } from './metaConnectorAudience';
import { normalizeName, normalizePhone, prepareAudience, sha256Hex } from '../../supabase/functions/meta-ads-connector/audience';
import { leadRows } from '../../supabase/functions/meta-ads-connector/leads';
import { adsetGoal, campaignPayload, creativeLink } from '../../supabase/functions/meta-ads-connector/rules';

describe('customer list parsing', () => {
  it('splits a full name and keeps email and phone', () => {
    expect(mapAudienceSheet([['Name', 'E-mail', 'Mobile Number'], ['Asha Rao K', 'a@x.com', '98450 11111'], ['', '', '']]))
      .toEqual([{ first_name: 'Asha', last_name: 'Rao K', email: 'a@x.com', phone: '98450 11111' }]);
  });
  it('requires an email or phone column', () => {
    expect(() => mapAudienceSheet([['Name'], ['A']])).toThrow(/email/);
  });
  it('counts only rows Meta can match', () => {
    expect(usableRows([{ first_name: 'A', last_name: '', email: 'bad', phone: '123' }, { first_name: '', last_name: '', email: '', phone: '9845011111' }])).toHaveLength(1);
  });
  it('neutralises formulas in CSV but keeps phone numbers', () => {
    expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"');
    expect(csvCell('+91 98450 11111')).toBe('"+91 98450 11111"');
  });
});

describe('server-side hashing', () => {
  it('normalises phone and names', () => {
    expect(normalizePhone('098450 11111')).toBe('919845011111');
    expect(normalizePhone('12345')).toBe('');
    expect(normalizeName(" O'Brien ")).toBe('obrien');
  });
  it('hashes in schema order, skipping invalid and duplicate rows', async () => {
    const r = await prepareAudience([
      { first_name: 'Asha', email: ' A@X.com ', phone: '9845011111' },
      { first_name: 'Again', email: 'a@x.com', phone: '+91 98450 11111' },
      { first_name: 'No contact' },
    ]);
    expect(r).toMatchObject({ invalid: 1, duplicates: 1 });
    expect(r.data).toEqual([[await sha256Hex('a@x.com'), await sha256Hex('919845011111'), await sha256Hex('asha'), '']]);
  });
});

describe('lead campaigns', () => {
  it('uses the leads objective, goal and instant form button', () => {
    expect(campaignPayload('L', [], 'leads')).toMatchObject({ objective: 'OUTCOME_LEADS', status: 'PAUSED' });
    expect(adsetGoal('leads', '1')).toEqual({ optimization_goal: 'LEAD_GENERATION', destination_type: 'ON_AD', promoted_object: { page_id: '1' } });
    expect(creativeLink('leads', 'SIGN_UP', undefined, '99').call_to_action).toEqual({ type: 'SIGN_UP', value: { lead_gen_form_id: '99' } });
    expect(() => creativeLink('leads', 'SIGN_UP', undefined, undefined)).toThrow();
  });
  it('leaves website campaigns as they were', () => {
    expect(campaignPayload('T', []).objective).toBe('OUTCOME_TRAFFIC');
    expect(adsetGoal('traffic', '1')).toEqual({ optimization_goal: 'LINK_CLICKS', destination_type: 'WEBSITE' });
    expect(creativeLink('traffic', 'LEARN_MORE', 'https://e.com', undefined)).toEqual({ link: 'https://e.com', call_to_action: { type: 'LEARN_MORE', value: { link: 'https://e.com' } } });
  });
  it("keeps only this campaign ad's leads", () => {
    const rows = leadRows([{ id: '1', ad_id: 'A', field_data: [{ name: 'full_name', values: ['Asha'] }] }, { id: '2', ad_id: 'B' }], 'c', 'f', 'A');
    expect(rows).toHaveLength(1);
    expect(rows[0].fields).toEqual({ full_name: 'Asha' });
  });
});
