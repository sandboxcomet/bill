import SharedBill from "@/components/SharedBill";
export const metadata = {
  title: "บิลแบ่งจ่าย",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SharedBill id={id} />;
}
