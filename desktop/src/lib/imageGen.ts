import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { createLocalStore } from "./localStore";
import { apiError, OPENROUTER_CHAT_URL, openRouterKeyStore, postJson } from "./openrouter";

export type ImageProvider = "comfyui" | "cloudflare" | "openrouter";

export const imageProviderStore = createLocalStore<ImageProvider>("trail.imagegen.provider", "comfyui");
export const comfyUrlStore = createLocalStore<string>("trail.imagegen.comfyUrl", "http://127.0.0.1:8000");
export const comfyDirStore = createLocalStore<string>("trail.imagegen.comfyDir", "C:/AI/ComfyUI/ComfyUI/ComfyUI");
export const cfAccountStore = createLocalStore<string>("trail.imagegen.cfAccount", "");
export const cfTokenStore = createLocalStore<string>("trail.imagegen.cfToken", "");

export interface ImageStyle {
  id: string;
  label: string;
  prompt: string;
}

export const IMAGE_STYLES: ImageStyle[] = [
  {
    id: "film",
    label: "Кадр",
    prompt: "Cinematic 35mm film photograph, candid moment, natural light, shallow depth of field, rich color grading, subtle film grain.",
  },
  {
    id: "anime",
    label: "Аниме",
    prompt: "Hand-painted anime film still, lush detailed background art, soft cinematic light, rich vibrant colors, expressive characters.",
  },
  {
    id: "clay",
    label: "Пластилин",
    prompt: "Claymation diorama, handmade plasticine characters and props, soft studio lighting, shallow depth of field, playful tactile 3D look, vivid colors.",
  },
  {
    id: "poster",
    label: "Постер",
    prompt: "Vintage 1970s illustrated poster, flat gouache shapes, sunburst light, warm retro palette of orange, teal and mustard, subtle paper texture.",
  },
  {
    id: "comic",
    label: "Комикс",
    prompt: "Graphic novel panel, bold black ink outlines, flat vivid colors, halftone shading, dynamic camera angle, exaggerated expressive characters.",
  },
  {
    id: "watercolor",
    label: "Акварель",
    prompt: "Loose watercolor and ink sketch, expressive linework, warm saturated washes, paper texture, lively editorial illustration.",
  },
  {
    id: "iso",
    label: "Изометрия",
    prompt: "Isometric 3D miniature diorama, cozy detailed tiny world, soft global illumination, bright cheerful toy-like colors.",
  },
];

export const imageStyleStore = createLocalStore<string>("trail.imagegen.style", IMAGE_STYLES[0].id);

export const PROFILE_SETTING = "imagegen_profile";

const NO_TEXT = "No text, no letters, no logos, no frame.";

const SCENE_SYSTEM = `You illustrate entries of a personal life log. An entry has a short title, sometimes a terse private note, a category and a hint, all in Russian, written for the author, not as a prompt: shorthand, slang, swearing, brand names, nicknames, details in brackets.

Step 1, silently: work out what actually happened, who was there and the mood of the moment.
- Russian grammar tells who acted: a plural verb ("катались", "съездили") means the author together with the author's partner from the profile unless others are named; a singular verb or no subject means the author alone. Keep the author's gender and looks from the profile, never swap them.
- The category is a strong hint: "Неприятное" means something bad or annoying happened; accidents, illness and death are serious.
- Slang and swearing usually mean the author is excited, amused or furious, not sad. Show strong emotions boldly and with humor, literal idioms are welcome as visual gags (smoke from ears, a burning backside).
- Most entries are everyday life told with humor: busy, proud, fun, cozy, absurd. Never default to gloomy or lonely.

Step 2: describe ONE vivid illustration of that moment. Name the characters with clear expressive faces and body language that show the mood, the setting, a few telling objects, the lighting and a color palette that fits the mood: warm and saturated for good moments, chaotic and clashing for annoyance, cool and muted for serious ones. Medium shot, characters large in the frame. When a person or pet from the profile appears, describe their looks from the profile in plain words, never their names. Serious topics stay respectful, never graphic or bloody. Never put words, names, labels, signs, logos, numbers or screens with text in the picture.

Examples:
Title: Новый год у родителей → A family laughing around a crowded holiday table in a small living room, a glowing fir tree and fairy lights, warm golden light, red and gold palette, snow outside the window.
Title: Сломал ногу (гипс). Category: Неприятное → A grumpy young man on a sofa with his leg in a white cast propped on cushions, crutches fallen on the floor, a cat staring at him, cool grey-blue afternoon light.

Reply in English with the description only, two or three sentences, under 70 words.`;

export interface SceneInput {
  title: string;
  note: string;
  category: string;
  hint: string;
  profile: string;
}

const WIDTH = 1024;
const HEIGHT = 576;

const CF_LLM = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const CF_IMAGE = "@cf/black-forest-labs/flux-2-klein-4b";
const OR_LLMS = ["google/gemini-2.5-flash", "google/gemma-4-31b-it:free", "openrouter/free"];
const LOCAL_LLM_URL = "http://127.0.0.1:1234/v1";
const OR_IMAGE = "black-forest-labs/flux.2-klein-4b";

const COMFY_UNET = "z_image_turbo_int8_convrot.safetensors";
const COMFY_CLIP = "qwen_3_4b_fp8_mixed.safetensors";
const COMFY_VAE = "ae.safetensors";

const NO_ORIGIN = { Origin: "" };

const COMFY_BOOT_MS = 2 * 60_000;

export async function renderImage(
  scene: string,
  styleId: string,
  onStatus?: (message: string) => void,
): Promise<File> {
  const style = IMAGE_STYLES.find((s) => s.id === styleId) ?? IMAGE_STYLES[0];
  const prompt = `${scene}\n\n${style.prompt} ${NO_TEXT}`;
  const provider = imageProviderStore.get();
  if (provider === "cloudflare") return generateCloudflare(prompt);
  if (provider === "openrouter") return generateOpenRouter(prompt);
  try {
    await ensureComfy(comfyBase(), onStatus);
    onStatus?.("Рисую");
    return await runComfy(comfyBase(), prompt);
  } catch (e) {
    if (!cfAccountStore.get().trim() || !cfTokenStore.get().trim()) throw e;
    onStatus?.("ComfyUI недоступен — рисую в Cloudflare");
    return generateCloudflare(prompt);
  }
}

export type EngineState = "ready" | "off" | "remote";

export async function comfyState(): Promise<EngineState> {
  const base = comfyBase();
  if (await comfyAlive(base)) return "ready";
  const host = new URL(base).hostname;
  return host === "127.0.0.1" || host === "localhost" ? "off" : "remote";
}

export function startComfy(onStatus?: (message: string) => void): Promise<void> {
  return ensureComfy(comfyBase(), onStatus);
}

export async function releaseImageModels(): Promise<void> {
  if (imageProviderStore.get() !== "comfyui") return;
  if (!(await invoke<boolean>("comfy_running").catch(() => false))) return;
  await fetch(`${comfyBase()}/free`, {
    method: "POST",
    headers: { ...NO_ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ unload_models: true, free_memory: true }),
  }).catch(() => {});
}

export function sceneModelLabel(): string {
  if (openRouterKeyStore.get().trim()) return "Gemini 2.5 Flash";
  if (cfAccountStore.get().trim() && cfTokenStore.get().trim()) return "Llama 3.3 (Cloudflare)";
  return "LM Studio";
}

function comfyBase() {
  return comfyUrlStore.get().trim().replace(/\/+$/, "");
}

async function comfyAlive(base: string): Promise<boolean> {
  try {
    return (await fetch(`${base}/system_stats`, { headers: NO_ORIGIN, connectTimeout: 1500 })).ok;
  } catch {
    return false;
  }
}

async function ensureComfy(base: string, onStatus?: (message: string) => void) {
  if (await comfyAlive(base)) return;
  const url = new URL(base);
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`ComfyUI не отвечает по адресу ${base}`);
  }
  try {
    await invoke("comfy_start", { dir: comfyDirStore.get().trim(), port: Number(url.port) || 80 });
  } catch (e) {
    throw new Error(String(e));
  }
  onStatus?.("Запускаю ComfyUI — первая картинка займёт около минуты");
  const deadline = Date.now() + COMFY_BOOT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await comfyAlive(base)) return;
    if (!(await invoke<boolean>("comfy_running"))) throw new Error("ComfyUI завершился при запуске");
  }
  throw new Error("ComfyUI не запустился за 2 минуты");
}

export async function describeScene(input: SceneInput): Promise<string> {
  const entry = [
    `Title: ${input.title.trim()}`,
    input.note.trim() && `Note: ${input.note.trim()}`,
    input.category && `Category: ${input.category}`,
    input.hint.trim() && `Hint from the author: ${input.hint.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");
  const system = input.profile.trim()
    ? `${SCENE_SYSTEM}\n\nProfile of the author and the people and pets in the entries (use only those who appear in the entry):\n${input.profile.trim()}`
    : SCENE_SYSTEM;
  return (await askScene(system, entry)) ?? [input.title.trim(), input.note.trim()].filter(Boolean).join(". ");
}

async function askScene(system: string, entry: string): Promise<string | null> {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: entry },
  ];
  const orKey = openRouterKeyStore.get().trim();
  const account = cfAccountStore.get().trim();
  const token = cfTokenStore.get().trim();
  const attempts = [
    orKey &&
      (async () => {
        const res = await postJson(OPENROUTER_CHAT_URL, orKey, {
          models: OR_LLMS,
          messages,
        });
        return res?.choices?.[0]?.message?.content;
      }),
    account &&
      token &&
      (async () => (await postJson(cfUrl(account, CF_LLM), token, { messages }))?.result?.response),
    async () => {
      const models = await (await fetch(`${LOCAL_LLM_URL}/models`, { headers: NO_ORIGIN })).json();
      const model: string | undefined = models?.data?.find((m: { id: string }) => !/embed/i.test(m.id))?.id;
      if (!model) return null;
      const res = await fetch(`${LOCAL_LLM_URL}/chat/completions`, {
        method: "POST",
        headers: { ...NO_ORIGIN, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: /qwen3/i.test(model)
            ? [messages[0], { ...messages[1], content: `${entry} /no_think` }]
            : messages,
          ttl: 60,
        }),
      });
      return (await res.json())?.choices?.[0]?.message?.content;
    },
  ];
  for (const attempt of attempts) {
    if (!attempt) continue;
    const scene = clean(await attempt().catch(() => null));
    if (scene) return scene;
  }
  return null;
}

function clean(text: unknown): string | null {
  if (typeof text !== "string") return null;
  const line = text.replace(/<think>[\s\S]*?<\/think>/g, "").trim().replace(/^["«]|["»]$/g, "");
  return line || null;
}

async function runComfy(base: string, prompt: string): Promise<File> {
  const workflow = {
    1: { class_type: "UNETLoader", inputs: { unet_name: COMFY_UNET, weight_dtype: "default" } },
    2: { class_type: "CLIPLoader", inputs: { clip_name: COMFY_CLIP, type: "lumina2", device: "default" } },
    3: { class_type: "VAELoader", inputs: { vae_name: COMFY_VAE } },
    4: { class_type: "ModelSamplingAuraFlow", inputs: { model: ["1", 0], shift: 3 } },
    5: { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: prompt } },
    6: { class_type: "ConditioningZeroOut", inputs: { conditioning: ["5", 0] } },
    7: { class_type: "EmptySD3LatentImage", inputs: { width: WIDTH, height: HEIGHT, batch_size: 1 } },
    8: {
      class_type: "KSampler",
      inputs: {
        model: ["4", 0],
        positive: ["5", 0],
        negative: ["6", 0],
        latent_image: ["7", 0],
        seed: Math.floor(Math.random() * 2 ** 32),
        steps: 8,
        cfg: 1,
        sampler_name: "res_multistep",
        scheduler: "simple",
        denoise: 1,
      },
    },
    9: { class_type: "VAEDecode", inputs: { samples: ["8", 0], vae: ["3", 0] } },
    10: { class_type: "PreviewImage", inputs: { images: ["9", 0] } },
  };

  let queued: Response;
  try {
    queued = await fetch(`${base}/prompt`, {
      method: "POST",
      headers: { ...NO_ORIGIN, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: workflow }),
    });
  } catch {
    throw new Error(`ComfyUI не отвечает по адресу ${base}`);
  }
  const { prompt_id: id, node_errors: nodeErrors } = await queued.json();
  if (!id) throw new Error(`ComfyUI отклонил задачу: ${JSON.stringify(nodeErrors).slice(0, 200)}`);

  const deadline = Date.now() + 5 * 60_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    const history = (await (await fetch(`${base}/history/${id}`, { headers: NO_ORIGIN })).json())[id];
    if (history?.status?.status_str === "error") throw new Error("ComfyUI не смог сгенерировать картинку");
    const image = history?.outputs?.["10"]?.images?.[0];
    if (!image) continue;
    const query = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder, type: image.type });
    const blob = await (await fetch(`${base}/view?${query}`, { headers: NO_ORIGIN })).blob();
    return new File([blob], "ai.png", { type: "image/png" });
  }
  throw new Error("ComfyUI не успел за 5 минут");
}

async function generateCloudflare(prompt: string): Promise<File> {
  const account = cfAccountStore.get().trim();
  const token = cfTokenStore.get().trim();
  if (!account || !token) throw new Error("Укажите Account ID и токен Cloudflare в настройках");
  const form = new FormData();
  form.append("prompt", prompt);
  form.append("width", String(WIDTH));
  form.append("height", String(HEIGHT));
  const res = await fetch(cfUrl(account, CF_IMAGE), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => null);
  const image = json?.result?.image;
  if (!res.ok || typeof image !== "string") throw new Error(apiError("Cloudflare", res.status, json));
  return base64ToFile(image);
}

async function generateOpenRouter(prompt: string): Promise<File> {
  const key = openRouterKeyStore.get().trim();
  if (!key) throw new Error("Укажите ключ OpenRouter в настройках");
  const json = await postJson(OPENROUTER_CHAT_URL, key, {
    model: OR_IMAGE,
    messages: [{ role: "user", content: prompt }],
    modalities: ["image"],
    image_config: { aspect_ratio: "16:9" },
  });
  const url = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (typeof url !== "string") throw new Error("OpenRouter не вернул картинку");
  return base64ToFile(url);
}

function cfUrl(account: string, model: string) {
  return `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`;
}

function base64ToFile(data: string): File {
  const match = /^data:([^;]+);base64,(.*)$/.exec(data);
  const raw = atob(match ? match[2] : data);
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const type = match?.[1] ?? (bytes[0] === 0x89 ? "image/png" : "image/jpeg");
  return new File([bytes], `ai.${type.split("/")[1]}`, { type });
}
