import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  cfAccountStore,
  cfTokenStore,
  comfyUrlStore,
  imageProviderStore,
  openRouterKeyStore,
  type ImageProvider,
} from "@/lib/imageGen";

const PROVIDER_SEGMENTS: { value: ImageProvider; label: string }[] = [
  { value: "comfyui", label: "ComfyUI" },
  { value: "cloudflare", label: "Cloudflare" },
  { value: "openrouter", label: "OpenRouter" },
];

const HINTS: Record<ImageProvider, string> = {
  comfyui: "Локально на видеокарте, бесплатно. ComfyUI должен быть запущен, модель — Z-Image Turbo.",
  cloudflare: "Workers AI, бесплатно до 10 000 нейронов в день. Токен с правом Workers AI.",
  openrouter: "FLUX.2 klein, около 1,5 цента за картинку.",
};

export function ImageGenPanel() {
  const provider = imageProviderStore.use();
  const comfyUrl = comfyUrlStore.use();
  const cfAccount = cfAccountStore.use();
  const cfToken = cfTokenStore.use();
  const orKey = openRouterKeyStore.use();

  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        segments={PROVIDER_SEGMENTS}
        value={provider}
        onChange={(v) => imageProviderStore.set(v)}
      />
      <p className="text-[13px] leading-snug text-muted">{HINTS[provider]}</p>
      {provider === "comfyui" && (
        <Input label="Адрес ComfyUI" value={comfyUrl} onChange={comfyUrlStore.set} spellCheck={false} />
      )}
      {provider === "cloudflare" && (
        <>
          <Input label="Account ID" value={cfAccount} onChange={cfAccountStore.set} spellCheck={false} />
          <Input label="Токен Cloudflare" type="password" value={cfToken} onChange={cfTokenStore.set} />
        </>
      )}
      <Input
        label="Ключ OpenRouter"
        type="password"
        value={orKey}
        onChange={openRouterKeyStore.set}
        placeholder={provider === "openrouter" ? "" : "Необязательно — бесплатные модели для сцены"}
      />
    </div>
  );
}
