import ItemOrder from "@/components/ItemOrder";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ItemOrder billId={id} />;
}
