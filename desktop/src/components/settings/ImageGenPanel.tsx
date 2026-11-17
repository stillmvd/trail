import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Cloud, Cpu, FolderOpen, KeyRound, Link, Route, Users } from "lucide-react";
import { ChoiceRow, FieldRow, Row, RowList } from "@/components/settings/tiles";
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

const ICON = { size: 20, strokeWidth: 1.75 };

const PROVIDERS: { value: ImageProvider; title: string; description: string; icon: ReactNode }[] = [
  {
    value: "comfyui",
    title: "ComfyUI",
    description: "На твоей видеокарте, бесплатно · Z-Image Turbo",
    icon: <Cpu {...ICON} />,
  },
  {
    value: "cloudflare",
    title: "Cloudflare",
    description: "Бесплатно до 10 000 нейронов в день · FLUX.2 Klein",
    icon: <Cloud {...ICON} />,
  },
  {
    value: "openrouter",
    title: "OpenRouter",
    description: "Около 1,5 цента за картинку · FLUX.2 Klein",
    icon: <Route {...ICON} />,
  },
];

const REVEAL = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { type: "spring" as const, bounce: 0, duration: 0.34 },
};

export function ImageGenPanel() {
  const provider = imageProviderStore.use();
  const comfyUrl = comfyUrlStore.use();
  const comfyDir = comfyDirStore.use();
  const cfAccount = cfAccountStore.use();
  const cfToken = cfTokenStore.use();
  const orKey = openRouterKeyStore.use();
  const cloudflare = provider !== "openrouter";

  return (
    <>
      <RowList title="Где рисовать">
        {PROVIDERS.map((p) => (
          <ChoiceRow
            key={p.value}
            icon={p.icon}
            title={p.title}
            description={p.description}
            selected={provider === p.value}
            onSelect={() => imageProviderStore.set(p.value)}
          />
        ))}
      </RowList>

      <AnimatePresence initial={false}>
        {provider === "comfyui" && (
          <motion.div key="comfy" {...REVEAL} className="-mt-7 overflow-hidden">
            <div className="pt-7">
              <RowList title="ComfyUI" still>
                <FieldRow
                  icon={<FolderOpen {...ICON} />}
                  title="Папка"
                  description="Trail сам запускает ComfyUI и выгружает модели при закрытии окна генерации"
                  value={comfyDir}
                  onChange={comfyDirStore.set}
                />
                <FieldRow icon={<Link {...ICON} />} title="Адрес" value={comfyUrl} onChange={comfyUrlStore.set} />
              </RowList>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RowList title="Ключи">
        <AnimatePresence initial={false}>
          {cloudflare && (
            <motion.div key="cf" {...REVEAL} className="relative overflow-hidden">
              <FieldRow
                icon={<Cloud {...ICON} />}
                title="Account ID Cloudflare"
                description={provider === "comfyui" ? "Запасной вариант, если ComfyUI не запустится" : undefined}
                value={cfAccount}
                onChange={cfAccountStore.set}
              />
              <div className="relative before:pointer-events-none before:absolute before:left-[68px] before:right-4 before:top-0 before:h-px before:bg-line before:content-['']">
                <FieldRow
                  icon={<KeyRound {...ICON} />}
                  title="Токен Cloudflare"
                  description="С правом Workers AI"
                  type="password"
                  value={cfToken}
                  onChange={cfTokenStore.set}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <FieldRow
          icon={<KeyRound {...ICON} />}
          title="Ключ OpenRouter"
          description={provider === "openrouter" ? undefined : "Необязательно: с ключом сцену описывает Gemini"}
          type="password"
          value={orKey}
          onChange={openRouterKeyStore.set}
        />
      </RowList>

      <RowList title="Кто есть кто">
        <ProfileField />
      </RowList>
    </>
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
    <div className="flex flex-col">
      <Row
        icon={<Users {...ICON} />}
        title="Внешность людей и питомцев"
        description="Попадает в описание сцены — модель берёт только тех, кто назван в событии"
      />
      <div className="px-2 pb-2">
        <Textarea
          aria-label="Кто есть кто"
          value={draft ?? saved ?? ""}
          onChange={change}
          rows={6}
          placeholder="Я — высокий, с бородой. Жена — светлые волосы до плеч. Кот — рыжий"
        />
      </div>
    </div>
  );
}
