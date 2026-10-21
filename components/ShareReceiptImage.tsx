"use client";
import { useEffect, useRef, useState } from "react";
import { receiptImage, type ReceiptImageData } from "@/lib/receipt-image";
import { useI18n } from "./LanguageProvider";
import { Icon } from "./Icons";

export default function ShareReceiptImage({ data }: { data: () => ReceiptImageData }) {
  const { t, feedback } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const blob = useRef<Blob | null>(null);
  const objectUrl = useRef("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }, []);
  async function prepare() {
    dialog.current?.showModal(); setBusy(true); setError(""); setUrl(""); blob.current = null;
    try {
      const image = await receiptImage(data(), t);
      blob.current = image;
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(image); setUrl(objectUrl.current);
    } catch { setError(t("errors.receiptImageFailed")); }
    finally { setBusy(false); }
  }
  function download() {
    if (!url) return;
    const link = document.createElement("a"); link.href = url; link.download = "clear-toh-bill.png"; link.click();
  }
  async function share() {
    if (!blob.current) return;
    const file = new File([blob.current], "clear-toh-bill.png", { type: "image/png" });
    if (!navigator.canShare?.({ files: [file] })) { download(); return; }
    try { await navigator.share({ files: [file], title: t("share.imageTitle") }); }
    catch (e) { if ((e as Error).name !== "AbortError") setError(t("errors.receiptImageShareFailed")); }
  }
  return <>
    <button className="button share-link-button" onClick={prepare} disabled={busy}><Icon name="receipt" size={16} />{t("share.image")}</button>
    <dialog ref={dialog} className="receipt-image-dialog" aria-labelledby="receipt-image-title">
      <div className="receipt-image-heading"><h2 id="receipt-image-title">{t("share.imageTitle")}</h2><button type="button" className="icon-button" aria-label={t("common.close")} onClick={() => dialog.current?.close()}><Icon name="close" /></button></div>
      {busy && <p role="status">{t("share.creatingImage")}</p>}
      {error && <p className="error" role="alert">{feedback(error)}</p>}
      {url && <img className="receipt-image-preview" src={url} alt={t("share.imageTitle")} />}
      <div className="receipt-image-actions">
        {error && !url && <button className="button secondary" onClick={prepare}>{t("common.tryAgain")}</button>}
        <button className="button secondary" onClick={download} disabled={!url || busy}>{t("share.saveImage")}</button>
        <button className="button primary" onClick={share} disabled={!url || busy}>{t("share.image")}</button>
      </div>
    </dialog>
  </>;
}
