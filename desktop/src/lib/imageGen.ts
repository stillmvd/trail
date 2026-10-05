import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { createLocalStore } from "./localStore";

export type ImageProvider = "comfyui" | "cloudflare" | "openrouter";

export const imageProviderStore = createLocalStore<ImageProvider>("trail.imagegen.provider", "comfyui");
export const comfyUrlStore = createLocalStore<string>("trail.imagegen.comfyUrl", "http://127.0.0.1:8000");
export const comfyDirStore = createLocalStore<string>("trail.imagegen.comfyDir", "C:/AI/ComfyUI/ComfyUI/ComfyUI");
export const cfAccountStore = createLocalStore<string>("trail.imagegen.cfAccount", "");
export const cfTokenStore = createLocalStore<string>("trail.imagegen.cfToken", "");
export const openRouterKeyStore = createLocalStore<string>("trail.imagegen.openRouterKey", "");

const STYLE =
  "Minimal hand-drawn illustration, flat simple shapes, soft natural colors, gentle grain texture. Cozy centered composition, the scene fills most of the frame, every mentioned detail is visible. Deep charcoal background. No text, no letters, no frame.";

const SCENE_SYSTEM = `You illustrate entries of a personal life log. An entry is a short title and sometimes a terse private note in Russian, written for the author, not as a prompt: shorthand, slang, brand names, details in brackets.

Work out what actually happened, then describe ONE illustration that shows that moment at a glance. Describe only what is visible: the main subject, the setting, one or two telling objects. No feelings, no backstory, no story over time. People are small simple figures seen from a distance or from behind, no faces. Hard topics (illness, death, accidents) stay gentle and symbolic, never graphic. Never put words, signs, logos, numbers or writing in the picture.

Examples:
Новый год у родителей → A small living room at night, a decorated fir tree glowing beside a set table, snow falling outside the window.
Сломал ногу (гипс) → A leg in a white cast resting on a cushion, crutches leaning against a sofa.

Reply in English with the description only, one or two sentences, under 35 words.`;

const WIDTH = 1024;
const HEIGHT = 576;

const CF_LLM = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const CF_IMAGE = "@cf/black-forest-labs/flux-2-klein-4b";
const OR_LLMS = ["google/gemma-4-31b-it:free", "qwen/qwen3.8-27b:free", "openrouter/free"];
const LOCAL_LLM_URL = "http://127.0.0.1:1234/v1";
const OR_IMAGE = "black-forest-labs/flux.2-klein-4b";

const COMFY_UNET = "z_image_turbo_int8_convrot.safetensors";
const COMFY_CLIP = "qwen_3_4b_fp8_mixed.safetensors";
const COMFY_VAE = "ae.safetensors";

const NO_ORIGIN = { Origin: "" };

const COMFY_BOOT_MS = 2 * 60_000;

export async function generateEventImage(
  title: string,
  description: string,
  onStatus?: (message: string) => void,
): Promise<File> {
  const entry = [title.trim(), description.trim()].filter(Boolean).join(". ");
  const scene = (await describeScene(entry)) || entry;
  const prompt = `${scene}\n\n${STYLE}`;
  const provider = imageProviderStore.get();
  if (provider === "cloudflare") return generateCloudflare(prompt);
  if (provider === "openrouter") return generateOpenRouter(prompt);
  try {
    return await generateComfy(prompt, onStatus);
  } catch (e) {
    if (!cfAccountStore.get().trim() || !cfTokenStore.get().trim()) throw e;
    onStatus?.("ComfyUI недоступен — рисую в Cloudflare");
    return generateCloudflare(prompt);
  }
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

async function describeScene(entry: string): Promise<string | null> {
  const messages = [
    { role: "system", content: SCENE_SYSTEM },
    { role: "user", content: entry },
  ];
  const orKey = openRouterKeyStore.get().trim();
  const account = cfAccountStore.get().trim();
  const token = cfTokenStore.get().trim();
  const attempts = [
    orKey &&
      (async () => {
        const res = await postJson("https://openrouter.ai/api/v1/chat/completions", orKey, {
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

async function generateComfy(prompt: string, onStatus?: (message: string) => void): Promise<File> {
  const base = comfyUrlStore.get().trim().replace(/\/+$/, "");
  await ensureComfy(base, onStatus);
  try {
    return await runComfy(base, prompt);
  } finally {
    if (await invoke<boolean>("comfy_running").catch(() => false)) {
      void fetch(`${base}/free`, {
        method: "POST",
        headers: { ...NO_ORIGIN, "Content-Type": "application/json" },
        body: JSON.stringify({ unload_models: true, free_memory: true }),
      }).catch(() => {});
    }
  }
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
  const json = await postJson("https://openrouter.ai/api/v1/chat/completions", key, {
    model: OR_IMAGE,
    messages: [{ role: "user", content: prompt }],
    modalities: ["image"],
    image_config: { aspect_ratio: "16:9" },
  });
  const url = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (typeof url !== "string") throw new Error("OpenRouter не вернул картинку");
  return base64ToFile(url);
}

async function postJson(url: string, token: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(apiError(new URL(url).hostname, res.status, json));
  return json;
}

function cfUrl(account: string, model: string) {
  return `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`;
}

function apiError(source: string, status: number, json: unknown) {
  const j = json as { error?: { message?: string }; errors?: { message?: string }[] } | null;
  const message = j?.error?.message ?? j?.errors?.[0]?.message;
  return `${source}: ${message ?? `ошибка ${status}`}`;
}

function base64ToFile(data: string): File {
  const match = /^data:([^;]+);base64,(.*)$/.exec(data);
  const raw = atob(match ? match[2] : data);
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const type = match?.[1] ?? (bytes[0] === 0x89 ? "image/png" : "image/jpeg");
  return new File([bytes], `ai.${type.split("/")[1]}`, { type });
}
