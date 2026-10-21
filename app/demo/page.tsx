import { requestLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
import BillEditor from "@/components/BillEditor";
export async function generateMetadata() { return {
  title: translate(await requestLocale(), "common.tryASampleBill"),
  robots: { index: false, follow: false },
}; }
export default function Page() {
  return <BillEditor demo />;
}
