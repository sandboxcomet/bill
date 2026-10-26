import { notFound, permanentRedirect } from "next/navigation";
import { isSharedBillPath, sharedBillPath } from "@/lib/bill-paths";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isSharedBillPath(sharedBillPath(id))) notFound();
  permanentRedirect(sharedBillPath(id));
}
