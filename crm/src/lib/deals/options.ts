export const CONTRACT_STATUSES = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'out_of_contract', label: 'Out of Contract' },
  { value: 'active_contract', label: 'Active Contract' },
] as const;

export const CALL_STATUSES = [
  { value: 'no_answer', label: 'No Answer' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'call_back_later', label: 'Call Back Later' },
  { value: 'interested', label: 'Interested' },
  { value: 'wrong_number', label: 'Wrong Number' },
] as const;

/** Explain which contact detail is absent while keeping contactless leads visible. */
export function missingContactLabel(hasPhone: boolean, hasEmail: boolean): string | null {
  if (hasPhone && hasEmail) return null;
  if (!hasPhone && hasEmail) return 'Missing phone';
  if (hasPhone && !hasEmail) return 'Missing email';
  return 'Missing Contact';
}
