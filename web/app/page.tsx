import { HomeShell } from "@/components/home-shell";
import { getMergedHomeSections } from "@/lib/browse-merge";

export default function HomePage() {
  const sections = getMergedHomeSections();
  return <HomeShell sections={sections} />;
}
