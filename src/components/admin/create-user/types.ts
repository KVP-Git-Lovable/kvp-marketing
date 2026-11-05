export interface Manager {
  id: string;
  username: string;
  full_name: string;
}

export interface SecurityProfile {
  id: string;
  name: string;
}

export interface FileUpload {
  file: File;
  type: 'address_proof' | 'id_proof' | 'photo';
  preview?: string;
}

export interface CreateUserFormData {
  /** Distributors this user will serve; empty means any. */
  distributor_ids: string[];
  primary_distributor_id: string | null;
  // Step 1: Basics
  email: string;
  password: string;
  username: string;
  full_name: string;
  phone_number: string;
  requirePasswordChange: boolean;
  
  // Step 2: Employment
  emergency_contact_number: string;
  monthly_salary: string;
  daily_da_allowance: string;
  security_profile_id: string;
  manager_id: string;
  secondary_manager_id: string;
  band: string;
  
  // Step 3: Additional Info
  hq: string;
  date_of_joining: string;
  date_of_exit: string;
  alternate_email: string;
  recovery_email: string;
  address: string;
  education: string;
  
  // Security (kept for backwards compat but optional)
  hint_question: string;
  hint_answer: string;
}

export const initialFormData: CreateUserFormData = {
  distributor_ids: [],
  primary_distributor_id: null,
  email: '',
  password: '',
  username: '',
  full_name: '',
  phone_number: '',
  requirePasswordChange: false,
  emergency_contact_number: '',
  monthly_salary: '',
  daily_da_allowance: '',
  security_profile_id: '',
  manager_id: '',
  secondary_manager_id: '',
  band: '',
  hq: '',
  date_of_joining: '',
  date_of_exit: '',
  alternate_email: '',
  recovery_email: '',
  address: '',
  education: '',
  hint_question: '',
  hint_answer: ''
};

export type WizardStep = 'basics' | 'employment' | 'additional' | 'documents';

export const WIZARD_STEPS: { id: WizardStep; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'employment', label: 'Employment' },
  { id: 'additional', label: 'Additional Info' },
  { id: 'documents', label: 'Documents' }
];
