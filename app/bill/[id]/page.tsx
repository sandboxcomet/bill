import { requestLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
import SharedBill from "@/components/SharedBill";
export async function generateMetadata() { return {
  title: translate(await requestLocale(), "bill.shared"),
  robots: { index: false, follow: false },
}; }
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SharedBill id={id} />;
}
