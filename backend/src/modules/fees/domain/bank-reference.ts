/** The Luhn check digit of a digit string (catches typos on bank slips). */
export function luhnDigit(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10;
}

/** A bank reference: the sequence, 10 digits, plus a check digit. */
export function bankReference(seq: number): string {
  const body = String(seq).padStart(10, '0');
  return `${body}${luhnDigit(body)}`;
}
