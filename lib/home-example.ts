import Decimal from "decimal.js";
import { calculateSettlements } from "./settlements";
import type { TranslationKey } from "./i18n";
export type HomeExampleMode = "equal" | "items" | "payers";
const people = [
  { id: "may", nameKey: "demo.may" },
  { id: "boss", nameKey: "demo.boss" },
  { id: "nat", nameKey: "demo.nat" },
] satisfies { id: string; nameKey: TranslationKey }[];
export function homeExample(mode: HomeExampleMode) {
  const rows: { nameKey: TranslationKey; amount: number; payerId: string; consumers: string[] }[] = mode === "equal"
    ? [{ nameKey: "demo.transport", amount: 480, payerId: "may", consumers: [] }, { nameKey: "demo.supplies", amount: 240, payerId: "may", consumers: [] }]
    : mode === "items"
      ? [{ nameKey: "home.exampleFood", amount: 600, payerId: "may", consumers: [] }, { nameKey: "home.exampleDrinks", amount: 300, payerId: "may", consumers: ["may", "boss"] }]
      : [{ nameKey: "home.exampleFood", amount: 600, payerId: "may", consumers: [] }, { nameKey: "demo.transport", amount: 300, payerId: "boss", consumers: [] }];
  const items = rows.map((row, i) => ({ ...row, id: `sample-${i}`, name: row.nameKey,
    price: new Decimal(row.amount), quantity: 1, discountRate: new Decimal(0), isShared: row.consumers.length === 0 }));
  const grandTotal = items.reduce((total, item) => total.plus(item.price), new Decimal(0));
  const calculation = calculateSettlements({ items, participants: people.map(p => ({ id: p.id, name: p.nameKey, totalPayable: new Decimal(0) })),
    serviceCharge: new Decimal(0), vat: new Decimal(0), grandTotal })!;
  return { people, items, grandTotal, calculation };
}
