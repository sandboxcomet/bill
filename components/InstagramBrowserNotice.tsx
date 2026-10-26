"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { browserHandoffUrl, isInstagramBrowser } from "@/lib/external-browser";
import { useI18n } from "./LanguageProvider";
import { Icon } from "./Icons";

export default function InstagramBrowserNotice() {
  const { t } = useI18n();
  const { status } = useSession();
  const titleId = useId();
  const manualInput = useRef<HTMLInputElement>(null);
  const [instagram, setInstagram] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  useEffect(() => { setInstagram(isInstagramBrowser(navigator.userAgent)); }, []);
  useEffect(() => { if (manualUrl) { manualInput.current?.focus(); manualInput.current?.select(); } }, [manualUrl]);
  if (!instagram || dismissed || status !== "unauthenticated") return null;
  async function copyLink() {
    const url = browserHandoffUrl(window.location.href);
    if (!url || copying) return;
    setCopying(true); setCopied(false); setManualUrl("");
    try { await navigator.clipboard.writeText(url); setCopied(true); }
    catch { setManualUrl(url); }
    finally { setCopying(false); }
  }
  return <aside className="instagram-browser-notice" aria-labelledby={titleId}>
    <div className="instagram-browser-heading">
      <h2 id={titleId}>{t("browser.instagramTitle")}</h2>
      <button type="button" className="icon-button" aria-label={t("common.close")} onClick={() => setDismissed(true)}><Icon name="close" size={18} /></button>
    </div>
    <p>{t("browser.instagramHint")}</p>
    <p className="instagram-browser-steps">{t("browser.instagramSteps")}</p>
    <button type="button" className="button primary" disabled={copying} onClick={copyLink}>
      <Icon name="copy" size={16} />{t("browser.copyLink")}
    </button>
    {copied && <p role="status">{t("browser.linkCopied")}</p>}
    {manualUrl && <div className="instagram-browser-manual">
      <label className="field"><span>{t("browser.copyManually")}</span>
        <input ref={manualInput} readOnly value={manualUrl} onFocus={event => event.currentTarget.select()} />
      </label>
    </div>}
  </aside>;
}
