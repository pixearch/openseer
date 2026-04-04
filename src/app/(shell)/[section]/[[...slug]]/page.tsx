import { notFound } from "next/navigation";
import { GraphWorkspacePage } from "@/components/openseer/GraphWorkspace";
import { SectionView } from "@/components/shell/SectionView";
import { NAV_SECTION_IDS } from "@/lib/nav/navigation";

type Props = {
  params: Promise<{ section: string; slug?: string[] }>;
};

export default async function SectionRoutePage({ params }: Props) {
  const { section, slug } = await params;
  if (!NAV_SECTION_IDS.has(section)) {
    notFound();
  }
  if (section === "workspace" && slug?.[0] === "graph") {
    return <GraphWorkspacePage />;
  }
  return <SectionView sectionId={section} />;
}
