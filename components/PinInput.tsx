"use client";
import { useI18n } from "@/components/LanguageProvider";

import { useEffect, useId, useRef, useState } from "react";
import { BILL_PIN_LENGTH } from "@/lib/pin";

function splitPin(value: string) {
  return Array.from({ length: BILL_PIN_LENGTH }, (_, index) =>
    /^\d{0,4}$/.test(value) ? (value[index] ?? "") : "",
  );
}

export default function PinInput({
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  required = false,
  invalid = false,
  describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const [digits, setDigits] = useState(() => splitPin(value));
  const emitted = useRef(value);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const incompatible = !/^\d{0,4}$/.test(value);

  useEffect(() => {
    if (value !== emitted.current) setDigits(splitPin(value));
    emitted.current = value;
  }, [value]);

  function commit(next: string[]) {
    setDigits(next);
    emitted.current = next.join("");
    onChange(emitted.current);
  }
  function focus(index: number) {
    const input = inputs.current[index];
    input?.focus();
    input?.select();
  }
  function write(index: number, text: string) {
    const incoming = text.replace(/\D/g, "");
    if (text && !incoming) return;
    const start = incoming.length >= BILL_PIN_LENGTH ? 0 : index;
    const next = [...digits];
    if (!incoming) next[start] = "";
    else {
      for (let offset = 0; offset < incoming.length; offset++) {
        if (start + offset >= BILL_PIN_LENGTH) break;
        next[start + offset] = incoming[offset];
      }
    }
    commit(next);
    focus(Math.min(start + incoming.length, BILL_PIN_LENGTH - 1));
  }

  return (
    <div className="pin-field" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`}>{t("pin.label")}</span>
      <div className="pin-boxes">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(input) => {
              inputs.current[index] = input;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]"
            maxLength={1}
            autoComplete="off"
            autoFocus={autoFocus && index === 0}
            required={required}
            disabled={disabled}
            aria-label={t("pin.digitLabel", [index + 1])}
            aria-invalid={invalid || incompatible || undefined}
            aria-describedby={incompatible ? `${id}-hint` : describedBy}
            value={digit}
            onFocus={(event) => event.currentTarget.select()}
            onClick={(event) => event.currentTarget.select()}
            onChange={(event) => write(index, event.target.value)}
            onPaste={(event) => {
              event.preventDefault();
              write(index, event.clipboardData.getData("text"));
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" || event.key === "Delete") {
                event.preventDefault();
                const target =
                  event.key === "Backspace" && !digits[index]
                    ? Math.max(0, index - 1)
                    : index;
                const next = [...digits];
                next[target] = "";
                commit(next);
                focus(target);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                focus(
                  Math.max(
                    0,
                    Math.min(
                      BILL_PIN_LENGTH - 1,
                      index + (event.key === "ArrowLeft" ? -1 : 1),
                    ),
                  ),
                );
              }
            }}
          />
        ))}
      </div>
      {incompatible && (
        <span id={`${id}-hint`} className="field-hint"> {t("pin.newLabel")} </span>
      )}
    </div>
  );
}
