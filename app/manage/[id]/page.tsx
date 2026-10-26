import BillEditor from "@/components/BillEditor";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BillEditor billId={id} />;
}
