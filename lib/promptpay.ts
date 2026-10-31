/** Validate a new PromptPay number, including the 13-digit ID check digit. */
export function isValidPromptPayId(value: string): boolean {
  if (/^0\d{9}$/.test(value)) return true;
  if (!/^\d{13}$/.test(value)) return false;
  const sum = [...value.slice(0, 12)].reduce((total, digit, index) => total + Number(digit) * (13 - index), 0);
  return (11 - (sum % 11)) % 10 === Number(value[12]);
}

export function promptPayErrorKey(value: string): "errors.promptPayChecksum" | "errors.promptPayFormat" {
  return /^\d{13}$/.test(value) ? "errors.promptPayChecksum" : "errors.promptPayFormat";
}
