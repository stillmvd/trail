import { DigestProvider, useDigest } from "@/components/digest/DigestProvider";
import { DigestSettings } from "@/components/digest/DigestSettings";
import { DigestView } from "@/components/digest/DigestView";
import { digestScreenStore } from "@/lib/digest/stores";

function DigestContent() {
  const { loaded, error } = useDigest();
  const screen = digestScreenStore.use();
  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-rust">
        Не удалось открыть базу данных: {error}
      </div>
    );
  }
  if (!loaded) return null;
  return screen === "settings" ? <DigestSettings /> : <DigestView />;
}

export function DigestPage() {
  return (
    <DigestProvider>
      <DigestContent />
    </DigestProvider>
  );
}
