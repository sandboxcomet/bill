import { requestLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
import Payment from "@/components/Payment";
import { prisma } from "@/lib/prisma";
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
  return <Payment id={id} pid={pid} />;
}
