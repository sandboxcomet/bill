import { isPromptPayId } from "@/lib/settlements";
import { primaryProfile } from "./account-identity";

export const participantPromptPayFields = {
  promptPayId: true,
  accountUser: { select: { promptPayId: true, mergedInto: { select: { promptPayId: true } } } },
} as const;

type Receiver = {
  promptPayId?: string | null;
  accountUser?: { promptPayId: string | null; mergedInto?: { promptPayId: string | null } | null } | null;
};

// The linked recipient controls their number. Keep the creator's saved number
// as a fallback so linking an account without PromptPay never clears it.
export function participantPromptPay(person: Receiver): string | null {
  const accountNumber = person.accountUser ? primaryProfile(person.accountUser).promptPayId : null;
  if (typeof accountNumber === "string" && isPromptPayId(accountNumber)) return accountNumber;
  return typeof person.promptPayId === "string" && isPromptPayId(person.promptPayId) ? person.promptPayId : null;
}
