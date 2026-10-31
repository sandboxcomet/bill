"use client";
import { useI18n } from "@/components/LanguageProvider";
import { useEffect, useId, useRef, useState } from "react";
import { isPromptPayId } from "@/lib/settlements";
import { Icon } from "./Icons";
import Link from "./LocalizedLink";
import { useSession } from "next-auth/react";
import { baht } from "@/lib/client";

type Person = { id: string; name: string; promptPayId?: string | null; accountUserId?: number | null; username?: string; hasPromptPay?: boolean };

export default function ItemPayer({ people, payerId, index, onSelect, onPromptPay, mode = "choice", paidUpfront, accountPromptPayId }: {
  people: Person[];
  payerId?: string | null;
  index: number;
  onSelect: (id: string) => void;
  onPromptPay: (id: string, value: string) => void;
  mode?: "choice" | "recipient";
  paidUpfront?: string;
  accountPromptPayId?: string | null;
}) {
  const { t, feedback } = useI18n();
  const { data: session } = useSession();
  const payer = people.find((p) => p.id === payerId);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const id = useId();
  const editingPerson = people.find((p) => p.id === editingId);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!editingPerson) {
      if (dialog?.open) dialog.close();
      return;
    }
    if (dialog && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingPerson]);
  useEffect(() => {
    if (!editingPerson || (value && !isPromptPayId(value)) || value === (editingPerson.promptPayId ?? "")) return;
    const timer = setTimeout(() => onPromptPay(editingPerson.id, value), 1000);
    return () => clearTimeout(timer);
  }, [editingPerson, value, onPromptPay]);
  function openPromptPay() {
    if (!payer) return;
    setValue(payer.promptPayId ?? "");
    setError("");
    setEditingId(payer.id);
  }
  function closePromptPay() {
    if (editingPerson && value && !isPromptPayId(value)) {
      setError(t("errors.promptPayFormat"));
      inputRef.current?.focus();
      return;
    }
    if (editingPerson && value !== (editingPerson.promptPayId ?? "")) onPromptPay(editingPerson.id, value);
    dialogRef.current?.close();
    setEditingId(null);
    setError("");
  }
  function savePromptPay(event: React.FormEvent) {
    event.preventDefault();
    if (!editingPerson) return;
    if (value && !isPromptPayId(value)) {
      setError(t("errors.promptPayFormat"));
      inputRef.current?.focus();
      return;
    }
    closePromptPay();
  }
  if (mode === "choice") return (
    <div className="item-payer">
      <div className="payer-choice" role="group" aria-label={t("payer.itemPayerLabel", [index + 1])}>
        <span className="payer-label">{t("bill.paidBy")}</span>
        <div className="allocation-chips">
          {people.map((p) => <button key={p.id} type="button" className="allocation-chip"
            aria-pressed={p.id === payerId} onClick={() => onSelect(p.id)}>{p.name}</button>)}
          {!people.length && <span className="field-hint">{t("payer.addParticipantsBeforeChoosingWhoPaid")}</span>}
        </div>
      </div>
      {!payer && people.length > 0 && <p className="field-hint">{t("payer.itemPayerHint")}</p>}
    </div>
  );
  if (!payer) return null;
  const accountPending = Boolean(payer.accountUserId && payer.hasPromptPay && accountPromptPayId === undefined);
  const accountNumber = payer.accountUserId ? accountPromptPayId : null;
  const fallbackNumber = isPromptPayId(payer.promptPayId ?? "") ? payer.promptPayId : null;
  return (
    <div className="item-payer payer-recipient">
      <div className="payer-recipient-name">
        <strong>{payer.name}</strong>
        <div className="payer-recipient-details">
          {paidUpfront !== undefined && <span className="payer-recipient-amount">{t("bill.paidUpfront")} <b>฿ {baht(paidUpfront)}</b></span>}
          {accountPending ? <span className="payer-promptpay-number">{t("payer.loadingPromptPay")}</span> : accountNumber ? (
            String(payer.accountUserId) === session?.user?.id
              ? <Link className="payer-promptpay-number" href="/settings" aria-label={t("nav.accountSettings")}>PromptPay <bdi>{accountNumber}</bdi></Link>
              : <span className="payer-promptpay-number">PromptPay <bdi>{accountNumber}</bdi></span>
          ) : fallbackNumber ? (
            <button type="button" className="payer-promptpay-number payer-promptpay-edit" aria-haspopup="dialog"
              aria-label={t("payer.promptPayActionLabel", [t("common.edit"), payer.name])} onClick={openPromptPay}>
              PromptPay <bdi>{fallbackNumber}</bdi> <Icon name="edit" size={14} />
            </button>
          ) : (
            <button type="button" className="payer-promptpay-button" aria-haspopup="dialog"
              aria-label={t("payer.promptPayActionLabel", [t("common.add"), payer.name])} onClick={openPromptPay}>
              <Icon name="wallet" size={16} /> {t("payer.addPromptPay")}
            </button>
          )}
        </div>
      </div>
      <dialog ref={dialogRef} className="promptpay-dialog"
        aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
        onCancel={(event) => { event.preventDefault(); closePromptPay(); }}
        onClose={() => { setEditingId(null); setError(""); }}
        onClick={(event) => { if (event.target === event.currentTarget) closePromptPay(); }}>
        <form className="promptpay-dialog-content" onSubmit={savePromptPay}>
          <div className="promptpay-dialog-heading">
            <h2 id={`${id}-title`}>{t("payer.promptPayFor")} {editingPerson?.name}</h2>
            <button type="button" className="icon-button" onClick={closePromptPay} aria-label={t("payer.closePromptPayDialog")}>
              <Icon name="close" size={20} />
            </button>
          </div>
          <p id={`${id}-description`} className="field-hint">{t("payer.reimbursementPrefix", [editingPerson?.name])}</p>
          <label className="field">
            <span>{t("payer.mobileNumberOrNationalID")}</span>
            <input ref={inputRef} type="text" inputMode="numeric" autoComplete="off"
              maxLength={13} enterKeyHint="done" placeholder={t("payer.promptPayPlaceholder")}
              value={value} aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(event) => { setValue(event.target.value.replace(/\D/g, "")); setError(""); }} />
          </label>
          {error && <p id={`${id}-error`} className="error" role="alert">{feedback(error)}</p>}
          <div className="promptpay-dialog-actions">
            <button type="submit" className="button primary">{t("common.done")}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
