export type BillPaymentStatus = "UNPAID" | "PARTIAL" | "REVIEW" | "BANK_PENDING" | "PAID" | "NO_PAYMENT";
export type BillListItem = {
  id: string;
  name: string;
  status: string;
  version: number;
  isPublic: boolean;
  grandTotal: string;
  createdAt: string;
  _count: { participants: number; items: number };
  payment: { status: BillPaymentStatus; remaining: string; settledCount: number; totalPeople: number } | null;
};
