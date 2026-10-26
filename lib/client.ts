export const baht = (value: string | number | { toString(): string }) =>
  new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
export class RequestError extends Error {
  constructor(message: string, public readonly status: number, public readonly code = message) { super(message); }
}
export async function request<T = any>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response
    .json()
    .catch(() => ({ error: "ไม่สามารถอ่านข้อมูลได้ กรุณาลองใหม่" }));
  if (!response.ok)
    throw new RequestError(
      response.status === 401
        ? "กรุณาเข้าสู่ระบบก่อนบันทึกบิล"
        : data.error || "ดำเนินการไม่สำเร็จ กรุณาลองใหม่",
      response.status,
      typeof data.error === "string" ? data.error : "",
    );
  return data;
}
export function jsonBody(data: unknown) {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}
