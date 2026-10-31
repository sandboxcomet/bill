import { requestLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
import MyBills from "@/components/MyBills";

export async function generateMetadata() { return { title: translate(await requestLocale(), "nav.dashboard") }; }

export default function DashboardPage() {
  return <MyBills overviewOnly />;
}
