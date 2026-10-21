import Friends from "@/components/Friends";
import { requestLocale } from "@/lib/server/locale";
import { translate } from "@/lib/i18n";
export async function generateMetadata() { return { title: translate(await requestLocale(), "social.pageTitle") }; }
export default function Page() { return <Friends />; }
