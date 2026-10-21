declare module "qrcode/lib/core/qrcode" {
  export function create(value: string, options: { errorCorrectionLevel: "H" }): {
    modules: { size: number; get(row: number, column: number): number };
  };
}
