import Payment from "@/components/Payment";
export const metadata = {
  title: "ยอดชำระของคุณ",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { id, pid } = await params;
  return <Payment id={id} pid={pid} />;
}
