export type ContactGateInput = {
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  company_website?: string | null;
};

export function hasPhoneOrEmail(input: ContactGateInput): boolean {
  const phone = (input.phone || '').trim();
  const email = (input.email || '').trim();
  return phone.length >= 7 || (email.includes('@') && email.includes('.'));
}

export function hasReachableContact(input: ContactGateInput): boolean {
  const website = (input.website || input.company_website || '').trim();
  return hasPhoneOrEmail(input) || (website.length > 0 && /^https?:\/\//i.test(website));
}
