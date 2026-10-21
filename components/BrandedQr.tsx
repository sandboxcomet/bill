"use client";
import { useI18n } from "@/components/LanguageProvider";
import { useEffect, useRef, useState } from "react";
import { brandedQrSvg } from "@/lib/branded-qr";

export default function BrandedQr({ value, title, onReady }: {
  value: string;
  title: string;
  onReady: (value: string) => void;
}) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) { setError(true); return; }
    onReady("");
    canvas.dataset.qrValue = "";
    context.clearRect(0, 0, canvas.width, canvas.height);
    setError(false);
    async function render() {
      let logo: string | undefined;
      try {
        const response = await fetch("/brand-mark.svg?v=clear-toh-friends-1");
        if (response.ok) logo = (await response.text()).match(/href="(data:image\/png;base64,[A-Za-z0-9+/=]+)"/)?.[1];
      } catch { /* The QR remains usable if the logo cannot load. */ }
      if (!active) return;
      const image = new Image();
      image.onload = () => {
        if (active) {
          context!.drawImage(image, 0, 0, canvas!.width, canvas!.height);
          canvas!.dataset.qrValue = value;
          onReady(value);
        }
      };
      image.onerror = () => { if (active) setError(true); };
      image.src = `data:image/svg+xml;base64,${btoa(brandedQrSvg(value, logo))}`;
    }
    void render().catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [value, onReady]);
  return <>
    <canvas key={value} ref={canvasRef} hidden={error} width={1024} height={1024} style={{ width: 240, height: "auto", maxWidth: "100%" }} role="img" aria-label={title} />
    {error && <p className="error" role="alert">{t("errors.qrFailed")}</p>}
  </>;
}
