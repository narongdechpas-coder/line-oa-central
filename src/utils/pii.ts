// PII masking for display. Data is fictional; masking demonstrates the control, not real protection.

/** '08X-XXX-1001' → '•••-•••-••01' (keeps the last 2 characters). */
export function maskPhone(phone: string): string {
  const keep = phone.slice(-2);
  return phone.slice(0, -2).replace(/[^-]/g, '•') + keep;
}

/** Generic mask for PII custom field values. */
export function maskValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  return '••••••';
}
