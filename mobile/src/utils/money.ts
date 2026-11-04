/** "$14" or "$14.50" in AUD. */
export const aud = (n: number) => `$${Number.isInteger(n) ? n : n.toFixed(2)}`;
