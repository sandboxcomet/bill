import { requestLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
import SharedBill from "@/components/SharedBill";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { optionalUserId } from "@/lib/server/authorization";
import { ownsAccount } from "@/lib/server/account-identity";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bill = await prisma.bill.findFirst({
    where: { id, isPublic: true, status: "PUBLISHED" },
    select: { name: true },
  });
  return {
    title: bill?.name || translate(await requestLocale(), "bill.shared"),
    robots: { index: false, follow: false },
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const bill = await prisma.bill.findUnique({ where: { id }, select: { status: true, userId: true } });
  if (!bill || bill.status === "UNSHARED" || (bill.status !== "PUBLISHED" && !await ownsAccount(await optionalUserId(), bill.userId))) notFound();
  return <SharedBill id={id} />;
}
