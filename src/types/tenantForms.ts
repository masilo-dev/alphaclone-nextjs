export type FormFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'number';

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface FormSettings {
  thankYouMessage?: string;
  createLead?: boolean;
  notifyEmail?: boolean;
}

export interface TenantForm {
  id: string;
  tenant_id: string;
  slug: string;
  title: string;
  description?: string | null;
  fields: FormField[];
  settings: FormSettings;
  is_active: boolean;
  is_default: boolean;
  submission_count: number;
  created_at: string;
  updated_at: string;
}

export interface FormSubmission {
  id: string;
  form_id: string;
  tenant_id: string;
  data: Record<string, string>;
  submitter_name?: string | null;
  submitter_email?: string | null;
  submitter_phone?: string | null;
  status: string;
  created_at: string;
}

export const DEFAULT_CONTACT_FIELDS: FormField[] = [
  { id: 'name', type: 'text', label: 'Full Name', required: true, placeholder: 'Your name' },
  { id: 'email', type: 'email', label: 'Email', required: true, placeholder: 'you@company.com' },
  { id: 'phone', type: 'phone', label: 'Phone', required: false, placeholder: '+1 555 000 0000' },
  { id: 'message', type: 'textarea', label: 'Message', required: true, placeholder: 'How can we help?' },
];
