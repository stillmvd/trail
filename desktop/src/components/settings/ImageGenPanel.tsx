import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Textarea } from "@/components/ui/Textarea";
import { setSetting } from "@/db/queries/settings";
import {
  PROFILE_SETTING,
  cfAccountStore,
  cfTokenStore,
  comfyDirStore,
  comfyUrlStore,
  imageProviderStore,
  loadImageProfile,
  type ImageProvider,
} from "@/lib/imageGen";
import { openRouterKeyStore } from "@/lib/openrouter";
import { setQueryData, useQuery } from "@/lib/useQuery";

const PROVIDER_SEGMENTS: { value: ImageProvider; label: string }[] = [
  { value: "comfyui", label: "ComfyUI" },
  { value: "cloudflare", label: "Cloudflare" },
  { value: "openrouter", label: "OpenRouter" },
];

const HINTS: Record<ImageProvider, string> = {
  comfyui:
    "Локально на видеокарте, бесплатно, модель Z-Image Turbo. Trail сам запускает ComfyUI и выгружает модели, когда закрываешь окно генерации; если не вышло — рисует в Cloudflare.",
  cloudflare: "Workers AI, бесплатно до 10 000 нейронов в день. Токен с правом Workers AI.",
  openrouter: "FLUX.2 klein, около 1,5 цента за картинку.",
};

export function ImageGenPanel() {
  const provider = imageProviderStore.use();
  const comfyUrl = comfyUrlStore.use();
  const comfyDir = comfyDirStore.use();
  const cfAccount = cfAccountStore.use();
  const cfToken = cfTokenStore.use();
  const orKey = openRouterKeyStore.use();

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl segments={PROVIDER_SEGMENTS} value={provider} onChange={(v) => imageProviderStore.set(v)} />
      <p className="text-[13px] leading-snug text-muted">{HINTS[provider]}</p>
      {provider === "comfyui" && (
        <>
          <Input label="Папка ComfyUI" value={comfyDir} onChange={comfyDirStore.set} spellCheck={false} />
          <Input label="Адрес ComfyUI" value={comfyUrl} onChange={comfyUrlStore.set} spellCheck={false} />
        </>
      )}
      {provider !== "openrouter" && (
        <>
          <Input
            label={provider === "comfyui" ? "Account ID Cloudflare — запасной" : "Account ID"}
            value={cfAccount}
            onChange={cfAccountStore.set}
            spellCheck={false}
          />
          <Input label="Токен Cloudflare" type="password" value={cfToken} onChange={cfTokenStore.set} />
        </>
      )}
      <Input
        label="Ключ OpenRouter"
        type="password"
        value={orKey}
        onChange={openRouterKeyStore.set}
        placeholder={provider === "openrouter" ? "" : "Необязательно — Gemini для сцены"}
      />
      <ProfileField />
    </div>
  );
}

function ProfileField() {
  const saved = useQuery(loadImageProfile).data;
  const [draft, setDraft] = useState<string | null>(null);
  const timer = useRef<number>(undefined);
  const pending = useRef<string | null>(null);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (pending.current !== null) void setSetting(PROFILE_SETTING, pending.current);
    },
    [],
  );

  function change(value: string) {
    setDraft(value);
    setQueryData(loadImageProfile, value);
    pending.current = value;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      pending.current = null;
      void setSetting(PROFILE_SETTING, value);
    }, 500);
  }

  return (
    <div className="flex flex-col gap-1">
      <Textarea
        label="Кто есть кто"
        value={draft ?? saved ?? ""}
        onChange={change}
        rows={8}
        placeholder="Кто ты, кто есть кто в событиях, как выглядят люди, питомцы и машины"
      />
      <p className="px-1 text-[13px] leading-snug text-muted">
        Уходит в промпт сцены, чтобы на картинках были узнаваемые вы. Модель берёт только тех, кто есть в событии.
      </p>
    </div>
  );
}
