import { requestLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
import Payment from "@/components/Payment";
export async function generateMetadata() { return {
  title: translate(await requestLocale(), "payment.title"),
  robots: { index: false, follow: false },
}; }
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { id, pid } = await params;
  return <Payment id={id} pid={pid} />;
}
