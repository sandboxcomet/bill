export const BILL_PIN_LENGTH = 4;

export function isBillPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}
