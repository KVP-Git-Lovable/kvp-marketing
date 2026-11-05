import { supabase } from "@/integrations/supabase/client";

export type DocumentType = 'invoices' | 'delivery_challans' | 'summaries' | 'reports';

export interface DocumentHeaderData {
  name: string;
  address: string;
  phone: string;
  email?: string;
  gstin: string;
  state?: string;
  bank_name?: string;
  bank_account?: string;
  ifsc?: string;
  account_holder_name?: string;
  qr_upi?: string;
  qr_code_url?: string;
  terms_conditions?: string;
  logo_url?: string;
}

interface DocumentSettings {
  invoices: 'company' | 'distributor';
  delivery_challans: 'company' | 'distributor';
  summaries: 'company' | 'distributor';
  reports: 'company' | 'distributor';
}

interface DistributorEnabledSetting {
  enabled: boolean;
}

/**
 * Fetch document header settings from the database
 */
export async function getDocumentSettings(): Promise<{
  headerSource: DocumentSettings;
  distributorEnabled: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from('invoice_document_settings')
      .select('setting_key, setting_value');

    if (error) {
      console.error('Error fetching document settings:', error);
      return {
        headerSource: {
          invoices: 'company',
          delivery_challans: 'company',
          summaries: 'company',
          reports: 'company',
        },
        distributorEnabled: false,
      };
    }

    let headerSource: DocumentSettings = {
      invoices: 'company',
      delivery_challans: 'company',
      summaries: 'company',
      reports: 'company',
    };
    let distributorEnabled = false;

    for (const row of data || []) {
      if (row.setting_key === 'document_header_source') {
        headerSource = row.setting_value as unknown as DocumentSettings;
      } else if (row.setting_key === 'distributor_details_enabled') {
        distributorEnabled = (row.setting_value as unknown as DistributorEnabledSetting).enabled;
      }
    }

    return { headerSource, distributorEnabled };
  } catch (err) {
    console.error('Error in getDocumentSettings:', err);
    return {
      headerSource: {
        invoices: 'company',
        delivery_challans: 'company',
        summaries: 'company',
        reports: 'company',
      },
      distributorEnabled: false,
    };
  }
}

/**
 * Get the header data for a document based on settings and retailer mapping
 * @param documentType - The type of document (invoices, delivery_challans, summaries, reports)
 * @param retailerId - The retailer ID to look up distributor mapping (optional for some document types)
 * @returns Header data from either company or distributor based on settings
 */
export async function getDocumentHeaderData(
  documentType: DocumentType,
  retailerId?: string
): Promise<DocumentHeaderData> {
  const { headerSource, distributorEnabled } = await getDocumentSettings();
  
  // If distributor is not enabled globally or source is company, use company data
  if (!distributorEnabled || headerSource[documentType] === 'company') {
    return getCompanyHeaderData();
  }

  // If source is distributor, try to get distributor data
  if (retailerId) {
    const distributorData = await getDistributorHeaderData(retailerId);
    if (distributorData) {
      return distributorData;
    }
  }

  // Fallback to company data if no distributor found
  return getCompanyHeaderData();
}

/**
 * Get company header data
 */
async function getCompanyHeaderData(): Promise<DocumentHeaderData> {
  try {
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .limit(1)
      .single();

    if (error || !company) {
      console.error('Error fetching company data:', error);
      return getDefaultHeaderData();
    }

    return {
      name: company.name || '',
      address: company.address || '',
      phone: company.contact_phone || '',
      email: company.email || '',
      gstin: company.gstin || '',
      state: company.state || '',
      bank_name: company.bank_name || '',
      bank_account: company.bank_account || '',
      ifsc: company.ifsc || '',
      account_holder_name: company.account_holder_name || '',
      qr_upi: company.qr_upi || '',
      qr_code_url: company.qr_code_url || '',
      terms_conditions: company.terms_conditions || '',
      logo_url: company.logo_url || '',
    };
  } catch (err) {
    console.error('Error in getCompanyHeaderData:', err);
    return getDefaultHeaderData();
  }
}

/**
 * Get distributor header data based on retailer's distributor mapping
 */
async function getDistributorHeaderData(retailerId: string): Promise<DocumentHeaderData | null> {
  try {
    // First, get the retailer to find their distributor_id
    const { data: retailer, error: retailerError } = await supabase
      .from('retailers')
      .select('distributor_id')
      .eq('id', retailerId)
      .single();

    if (retailerError || !retailer?.distributor_id) {
      console.log('No distributor mapped for retailer:', retailerId);
      return null;
    }

    // Fetch from distributors table (not retailers table)
    const { data: distributor, error: distributorError } = await supabase
      .from('distributors')
      .select('*')
      .eq('id', retailer.distributor_id)
      .single();

    if (distributorError || !distributor) {
      console.error('Error fetching distributor data:', distributorError);
      return null;
    }

    return {
      name: distributor.name || '',
      address: distributor.address || '',
      phone: distributor.phone || '',
      email: distributor.email || '',
      gstin: distributor.gst_number || '',
      state: distributor.state || '',
      bank_name: distributor.bank_name || '',
      bank_account: distributor.bank_account || '',
      ifsc: distributor.ifsc || '',
      account_holder_name: distributor.account_holder_name || '',
      qr_upi: distributor.qr_upi || '',
      qr_code_url: distributor.qr_code_url || '',
      terms_conditions: distributor.terms_conditions || '',
      logo_url: distributor.logo_url || '',
    };
  } catch (err) {
    console.error('Error in getDistributorHeaderData:', err);
    return null;
  }
}

/**
 * Default header data when nothing is available
 */
function getDefaultHeaderData(): DocumentHeaderData {
  return {
    name: 'Company Name',
    address: '',
    phone: '',
    email: '',
    gstin: '',
    state: '',
    bank_name: '',
    bank_account: '',
    ifsc: '',
    account_holder_name: '',
    qr_upi: '',
    qr_code_url: '',
    terms_conditions: '',
    logo_url: '',
  };
}

/**
 * Update document settings
 */
export async function updateDocumentSettings(
  headerSource: DocumentSettings,
  distributorEnabled: boolean
): Promise<boolean> {
  try {
    // Update header source - use update since record already exists
    const { error: error1 } = await supabase
      .from('invoice_document_settings')
      .update({
        setting_value: JSON.parse(JSON.stringify(headerSource)),
      })
      .eq('setting_key', 'document_header_source');

    if (error1) {
      console.error('Error updating header source:', error1);
      return false;
    }

    // Update distributor enabled
    const { error: error2 } = await supabase
      .from('invoice_document_settings')
      .update({
        setting_value: JSON.parse(JSON.stringify({ enabled: distributorEnabled })),
      })
      .eq('setting_key', 'distributor_details_enabled');

    if (error2) {
      console.error('Error updating distributor enabled:', error2);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in updateDocumentSettings:', err);
    return false;
  }
}
