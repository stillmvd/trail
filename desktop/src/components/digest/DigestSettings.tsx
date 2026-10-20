import { ArrowLeft } from "lucide-react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DigestPickTab, DigestRunTab } from "@/components/settings/DigestSettingsPanel";
import { DigestSourceManager } from "@/components/settings/DigestSourceManager";
import { digestScreenStore, digestSettingsTabStore, type DigestSettingsTab } from "@/lib/digest/stores";
import { useDigest } from "./DigestProvider";

const TABS: { value: DigestSettingsTab; label: string }[] = [
  { value: "pick", label: "Отбор" },
  { value: "sources", label: "Источники" },
  { value: "run", label: "Сбор и хранение" },
];

export function DigestSettings() {
  const tab = digestSettingsTabStore.use();
  const { status } = useDigest();
  if (!status) return null;
  const { config } = status;

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            aria-label="К сводке"
            title="К сводке"
            onClick={() => digestScreenStore.set("feed")}
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-surface-2 text-app-text transition-[background-color,scale] duration-150 ease-[var(--rg-ease)] hover:bg-surface-3 active:scale-[0.96]"
          >
            <ArrowLeft size={18} strokeWidth={1.75} />
          </button>
          <h2 className="text-[28px] leading-[1.06] font-light tracking-[-0.02em] text-app-text">
            Настройки <b className="font-bold">сводки</b>
          </h2>
          <span className="flex-1" />
          <SegmentedControl segments={TABS} value={tab} onChange={digestSettingsTabStore.set} />
        </div>

        {tab === "pick" && <DigestPickTab config={config} />}
        {tab === "sources" && <DigestSourceManager hnMinPoints={config.hnMinPoints} />}
        {tab === "run" && <DigestRunTab config={config} />}
      </div>
    </div>
  );
}
