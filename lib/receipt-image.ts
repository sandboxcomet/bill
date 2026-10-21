import { brandedQrSvg } from "./branded-qr";
import { baht } from "./client";
import type { Translate } from "./i18n";

export type ReceiptImageData = {
  name: string; date: string; total: string; url: string; complete: boolean; privateBill: boolean;
  people: { name: string; costs: string; due: string; receive: string }[];
};
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not load")); image.src = src;
  });
}
export async function receiptImage(data: ReceiptImageData, t: Translate): Promise<Blob> {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 840; canvas.height = 780 + data.people.length * 106;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const font = getComputedStyle(document.body).fontFamily;
  const text = (value: string, x: number, y: number, size = 26, bold = false, color = "#1c302b", align: CanvasTextAlign = "left", maxWidth?: number) => {
    ctx.font = `${bold ? 600 : 400} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align;
    ctx.fillText(value, x, y, maxWidth);
  };
  const line = (y: number) => { ctx.strokeStyle = "#cddbd5"; ctx.setLineDash([5, 6]); ctx.beginPath(); ctx.moveTo(48, y); ctx.lineTo(792, y); ctx.stroke(); ctx.setLineDash([]); };
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  let logo: string | undefined;
  let logoImage: HTMLImageElement | undefined;
  try {
    const response = await fetch("/brand-mark.svg?v=clear-toh-friends-1");
    if (response.ok) logo = (await response.text()).match(/href="(data:image\/png;base64,[A-Za-z0-9+/=]+)"/)?.[1];
    if (logo) logoImage = await loadImage(logo);
  } catch { /* Text branding and the QR remain usable without the mark. */ }
  ctx.font = `600 30px ${font}`;
  const thaiWidth = ctx.measureText("เคลียร์โต๊ะ").width;
  ctx.font = `400 19px ${font}`;
  const wordmarkWidth = Math.max(thaiWidth, ctx.measureText("Clear Toh").width);
  const markWidth = logoImage ? 64 + 14 : 0;
  const brandLeft = (canvas.width - markWidth - wordmarkWidth) / 2;
  if (logoImage) ctx.drawImage(logoImage, brandLeft, 34, 64, 64);
  text("เคลียร์โต๊ะ", brandLeft + markWidth, 70, 30, true);
  text("Clear Toh", brandLeft + markWidth, 98, 19, false, "#176348");
  text(data.name, 420, 156, 34, true, "#1c302b", "center", 744);
  text(data.date, 420, 198, 22, false, "#65766e", "center");
  line(230);
  text(t("bill.total"), 48, 288, 27); text(`฿ ${baht(data.total)}`, 792, 288, 40, true, "#176348", "right");
  line(328);
  data.people.forEach((person, index) => {
    const y = 374 + index * 106;
    text(person.name, 48, y, 28, true, "#1c302b", "left", 380);
    text(`${t("bill.costs")} ฿ ${baht(person.costs)}`, 48, y + 36, 22, false, "#65766e");
    const due = Number(person.due) > 0, receive = Number(person.receive) > 0;
    text(due ? `${t("payment.toPay")} ฿ ${baht(person.due)}` : t(receive ? "payment.noPaymentDue" : "bill.status.settled"), 792, y, 26, true, "#176348", "right", 350);
    if (receive) text(`${t("payment.toReceive")} ฿ ${baht(person.receive)}`, 792, y + 36, 22, false, "#176348", "right", 350);
  });
  const footer = 346 + data.people.length * 106;
  line(footer);
  const qr = await loadImage(`data:image/svg+xml;base64,${btoa(brandedQrSvg(data.url, logo))}`);
  ctx.drawImage(qr, 310, footer + 18, 220, 220);
  text(t("share.qrCaption"), 420, footer + 278, 25, true, "#176348", "center");
  text(t(data.privateBill ? "share.pinNotice" : "share.snapshotNotice"), 420, footer + 318, 20, false, "#65766e", "center", 744);
  if (data.complete) {
    ctx.save(); ctx.translate(690, footer + 170); ctx.rotate(-0.12); ctx.strokeStyle = "#176348"; ctx.lineWidth = 3; ctx.strokeRect(-96, -28, 192, 56);
    text(t("bill.status.settled"), 0, 10, 27, true, "#176348", "center"); ctx.restore();
  }
  ctx.fillStyle = "#f3f7f5"; ctx.beginPath(); ctx.moveTo(0, canvas.height);
  for (let x = 0; x <= 840; x += 24) { ctx.lineTo(x, canvas.height - 10); ctx.lineTo(x + 12, canvas.height); }
  ctx.fill();
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PNG export failed")), "image/png"));
}
