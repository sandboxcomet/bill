export type BillEditorPerson = { id: string; name: string; isPayer: boolean; ownerAlias?: string | null; accountName?: string; image?: string | null; promptPayId?: string | null; accountUserId?: number | null; canonicalAccountUserId?: number; username?: string; hasPromptPay?: boolean };
export type BillEditorItem = {
  id: string; name: string; price: string; quantity: number; discountRate: string;
  isShared: boolean; includeSC: boolean; includeVat: boolean; consumers: string[];
  consumerQuantities?: Record<string, number>; payerId?: string | null; restaurantId?: string | null;
};
export type BillItemProps = {
  item: BillEditorItem; index: number; total: string; participants: BillEditorPerson[];
  payerCandidates: BillEditorPerson[]; restaurants: { id: string; name: string }[];
  itemPayersEnabled: boolean; locked: boolean; saving: boolean; allSelected: boolean;
  onUpdate: (changes: Partial<BillEditorItem>, immediate?: boolean) => void;
  onToggleParticipant: (id: string) => void; onUpdateParts: (id: string, value: string) => void;
  onPromptPay: (id: string, value: string) => void; onRemove: () => void;
};
