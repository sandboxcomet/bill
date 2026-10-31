import { requestLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
import BillEditor from "@/components/BillEditor";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { personFields, publicPerson } from "@/lib/server/social";
import { notFound, redirect } from "next/navigation";
import { accountUserIds } from "@/lib/server/account-identity";
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
  const ids = await accountUserIds(Number(session.user.id));
  if (groupId) {
    const source = await prisma.friendGroup.findFirst({ where: { id: groupId, userId: { in: ids } },
      include: { members: { include: { user: { select: personFields } } } } });
    if (!source) notFound();
    const members = [...new Map(source.members.map(m => { const person = publicPerson(m.user); return [person.id, person]; })).values()];
    const sourceId = `group:${source.id}:${draftRound}`;
    return <BillEditor key={sourceId} repeatGroup={{ sourceId, names: [], members }} />;
  }
  const source = await prisma.bill.findFirst({ where: { id: repeatId!, userId: { in: ids } },
    select: { id: true, participants: { where: { archived: false }, select: { name: true, accountUser: { select: personFields } }, orderBy: { id: "asc" } } } });
  if (!source) notFound();
  const sourceId = `${source.id}:${draftRound}`;
  const seen = new Set<number>();
  const people = source.participants.flatMap(p => {
    if (!p.accountUser?.username) return [{ name: p.name }];
    const person = publicPerson(p.accountUser);
    if (seen.has(person.id)) return [];
    seen.add(person.id);
    return [{ name: person.name, accountUserId: person.id, image: person.image, username: person.username, hasPromptPay: person.hasPromptPay }];
  });
  return <BillEditor key={sourceId} repeatGroup={{ sourceId, names: [], people }} />;
}
