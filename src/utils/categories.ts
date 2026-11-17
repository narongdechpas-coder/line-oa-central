// Case categories and the skills each one needs (drives PIC skill match).
export const CASE_CATEGORIES: Record<string, string[]> = {
  'Motor Claim': ['claims', 'motor'],
  'Property Claim': ['claims', 'property'],
  'Travel Claim': ['claims', 'travel', 'documents'],
  'Repair Coordination': ['claims', 'repair'],
  'Policy Service': ['service', 'policy'],
  Renewal: ['renewal'],
  Billing: ['service', 'billing'],
  Complaint: ['service', 'customer'],
  Quotation: ['sales', 'quotation'],
  'Commercial Property': ['underwriting', 'property'],
  'General Inquiry': ['customer'],
};

export const CATEGORY_NAMES = Object.keys(CASE_CATEGORIES);
export const skillsForCategory = (category: string): string[] => CASE_CATEGORIES[category] ?? [];
