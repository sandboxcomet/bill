import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Onboarding from "@/components/Onboarding";
import { safeAccountReturn } from "@/lib/social";
import { requestLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
export async function generateMetadata() { return { title: translate(await requestLocale(), "account.setupTitle") }; }
export default async function Page({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  if (session?.user?.username) redirect(safeAccountReturn(params.callbackUrl));
  return <Onboarding destination={safeAccountReturn(params.callbackUrl)} />;
}
