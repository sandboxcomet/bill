import { requestLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
import BillEditor from "@/components/BillEditor";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { personFields, publicPerson } from "@/lib/server/social";
import { notFound, redirect } from "next/navigation";
export async function generateMetadata() { return { title: translate(await requestLocale(), "bill.create") }; }
type Query = { repeat?: string | string[]; round?: string | string[]; group?: string | string[] };
export default async function Page({ searchParams }: { searchParams: Promise<Query> }) {
  const { repeat, round, group } = await searchParams;
  const groupId = typeof group === "string" && group ? group : null;
  const repeatId = typeof repeat === "string" && repeat ? repeat : null;
  if (!groupId && !repeatId) return <BillEditor />;
  const draftRound = typeof round === "string" && /^[a-zA-Z0-9-]{1,64}$/.test(round) ? round : "group";
  const session = await auth();
  const destination = `/new?${groupId ? `group=${encodeURIComponent(groupId)}` : `repeat=${encodeURIComponent(repeatId!)}`}&round=${draftRound}`;
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(destination)}`);
  if (!session.user.username) redirect(`/onboarding?callbackUrl=${encodeURIComponent(destination)}`);
  if (groupId) {
    const source = await prisma.friendGroup.findFirst({ where: { id: groupId, userId: Number(session.user.id) },
      include: { members: { include: { user: { select: personFields } } } } });
    if (!source) notFound();
    const members = source.members.map(m => publicPerson(m.user));
    const sourceId = `group:${source.id}:${draftRound}`;
    return <BillEditor key={sourceId} repeatGroup={{ sourceId, names: [], members }} />;
  }
  const source = await prisma.bill.findFirst({ where: { id: repeatId!, userId: Number(session.user.id) },
    select: { id: true, participants: { where: { archived: false }, select: { name: true, accountUser: { select: personFields } }, orderBy: { id: "asc" } } } });
  if (!source) notFound();
  const sourceId = `${source.id}:${draftRound}`;
  const people = source.participants.map(p => p.accountUser?.username ? {
    name: publicPerson(p.accountUser).name, accountUserId: p.accountUser.id, username: p.accountUser.username,
    hasPromptPay: publicPerson(p.accountUser).hasPromptPay,
  } : { name: p.name });
  return <BillEditor key={sourceId} repeatGroup={{ sourceId, names: [], people }} />;
}
