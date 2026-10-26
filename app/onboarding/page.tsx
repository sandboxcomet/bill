import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Onboarding from "@/components/Onboarding";
import { safeAccountReturn } from "@/lib/social";
import { requestLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
import { hasCompleteProfile } from "@/lib/profile";
export async function generateMetadata() { return { title: translate(await requestLocale(), "account.setupTitle") }; }
export default async function Page({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const params = await searchParams;
  const session = await auth();
  const destination = safeAccountReturn(params.callbackUrl);
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/onboarding?callbackUrl=${encodeURIComponent(destination)}`)}`);
  if (hasCompleteProfile(session.user)) redirect(destination);
  return <Onboarding destination={destination} initialUsername={session.user.username ?? ""} initialNickname={session.user.nickname ?? ""} />;
}
