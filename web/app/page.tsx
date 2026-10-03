import { HomeShell } from "@/components/home-shell";
import { getMergedHomeSections } from "@/lib/browse-merge";
import { getLang } from "@/lib/i18n/server";
import { localizeCards } from "@/lib/listing-localize";

export default async function HomePage() {
  const lang = await getLang();
  const sections = getMergedHomeSections();
  const entries = await Promise.all(
    Object.entries(sections).map(async ([k, list]) => [k, await localizeCards(list, lang)] as const)
  );
  return <HomeShell sections={Object.fromEntries(entries) as typeof sections} />;
}
