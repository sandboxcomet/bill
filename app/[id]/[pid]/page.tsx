import { requestLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
import Payment from "@/components/Payment";
import { participantPaymentPath } from "@/lib/bill-paths";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { hasCompleteProfile } from "@/lib/profile";
export async function generateMetadata({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  const bill = await prisma.bill.findFirst({
    where: { id, isPublic: true, status: "PUBLISHED", participants: { some: { id: pid, archived: false } } },
    select: { name: true },
  });
  return {
    title: bill?.name || translate(await requestLocale(), "payment.title"),
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { id, pid } = await params;
  const bill = await prisma.bill.findUnique({ where: { id }, select: { status: true } });
  if (!bill || bill.status === "UNSHARED") notFound();
  const destination = participantPaymentPath(id, pid);
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(destination)}`);
  if (!hasCompleteProfile(session.user)) redirect(`/onboarding?callbackUrl=${encodeURIComponent(destination)}`);
  return <Payment id={id} pid={pid} />;
}
