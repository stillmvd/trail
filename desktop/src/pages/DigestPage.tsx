import { DigestProvider, useDigest } from "@/components/digest/DigestProvider";
import { DigestView } from "@/components/digest/DigestView";

function DigestContent() {
  const { loaded, error } = useDigest();
  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-rust">
        Не удалось открыть базу данных: {error}
      </div>
    );
  }
  if (!loaded) return null;
  return <DigestView />;
}

export function DigestPage() {
  return (
    <DigestProvider>
      <DigestContent />
    </DigestProvider>
  );
}
