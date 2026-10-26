import { notFound, permanentRedirect } from "next/navigation";
import { isSharedBillPath, sharedBillPath, participantPaymentPath } from "@/lib/bill-paths";
export default async function Page({ params }: { params: Promise<{ id: string; pid: string }> }) {
  const { id, pid } = await params;
  if (!isSharedBillPath(sharedBillPath(id))) notFound();
  permanentRedirect(participantPaymentPath(id, pid));
}
