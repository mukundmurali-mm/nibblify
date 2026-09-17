import json
import os
from pathlib import Path

import httpx

from youtube_service import format_transcript_for_claude


SYSTEM_PROMPT = """You are an expert at breaking educational YouTube video transcripts into logical learning episodes.

Given a timestamped transcript, identify natural topic boundaries and create episodes that:
- Are roughly 10-30 minutes each (but always follow content logic over time targets)
- Cover a complete concept or topic with a clear beginning and end
- Have a concise, descriptive title (like a podcast or course episode title)
- Include a 2-3 sentence summary of what the viewer will learn

Return ONLY a JSON object (no prose, no code fences) with this exact shape:
{
  "episodes": [
    {
      "title": "Episode title",
      "summary": "What the viewer will learn in this episode.",
      "start_time": 0.0,
      "end_time": 600.0
    }
  ]
}

Times are in seconds. Episodes must be sequential and together cover the full video duration."""


# ---------- Provider defaults ----------

PROVIDERS = ("deepseek", "ollama")

DEEPSEEK_BASE_URL = os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL_DEFAULT = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

OLLAMA_BASE_URL_DEFAULT = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL_DEFAULT = os.environ.get("OLLAMA_MODEL", "llama3.1")


# ---------- Errors ----------

class MissingApiKeyError(RuntimeError):
    """Required credentials/config missing for the active provider."""


class LLMApiError(RuntimeError):
    """Upstream LLM call failed (network / server / bad response)."""


# ---------- Config store ----------

def _config_path() -> Path:
    base = os.environ.get("NIBBLIFY_CONFIG_DIR")
    if base:
        return Path(base) / "config.json"
    return Path(__file__).resolve().parent / "config.json"


def _load_config() -> dict:
    p = _config_path()
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text())
    except Exception:
        return {}


def _save_config(data: dict) -> None:
    p = _config_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2))
    try:
        os.chmod(p, 0o600)
    except Exception:
        pass


def get_provider() -> str:
    cfg = _load_config()
    p = (cfg.get("provider") or os.environ.get("NIBBLIFY_PROVIDER") or "deepseek").lower()
    return p if p in PROVIDERS else "deepseek"


def get_deepseek_api_key() -> str | None:
    env = os.environ.get("DEEPSEEK_API_KEY")
    if env and env.strip():
        return env.strip()
    key = _load_config().get("deepseek_api_key")
    if key and str(key).strip():
        return str(key).strip()
    return None


def deepseek_key_source() -> str | None:
    if os.environ.get("DEEPSEEK_API_KEY", "").strip():
        return "env"
    if _load_config().get("deepseek_api_key"):
        return "config"
    return None


def get_ollama_base_url() -> str:
    cfg = _load_config()
    return (cfg.get("ollama_base_url") or OLLAMA_BASE_URL_DEFAULT).rstrip("/")


def get_ollama_model() -> str:
    cfg = _load_config()
    return cfg.get("ollama_model") or OLLAMA_MODEL_DEFAULT


def active_model() -> str:
    provider = get_provider()
    if provider == "ollama":
        return get_ollama_model()
    cfg = _load_config()
    return cfg.get("deepseek_model") or DEEPSEEK_MODEL_DEFAULT


def update_settings(patch: dict) -> dict:
    """Apply a partial settings update. Unknown keys ignored."""
    cfg = _load_config()

    if "provider" in patch and patch["provider"] is not None:
        v = str(patch["provider"]).lower()
        if v not in PROVIDERS:
            raise ValueError(f"Unknown provider: {v}. Use one of {PROVIDERS}.")
        cfg["provider"] = v

    if "deepseek_api_key" in patch and patch["deepseek_api_key"] is not None:
        v = str(patch["deepseek_api_key"]).strip()
        if not v:
            raise ValueError("deepseek_api_key is empty.")
        cfg["deepseek_api_key"] = v

    if "ollama_base_url" in patch and patch["ollama_base_url"] is not None:
        v = str(patch["ollama_base_url"]).strip().rstrip("/")
        if not v:
            raise ValueError("ollama_base_url is empty.")
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("ollama_base_url must start with http:// or https://")
        cfg["ollama_base_url"] = v

    if "ollama_model" in patch and patch["ollama_model"] is not None:
        v = str(patch["ollama_model"]).strip()
        if not v:
            raise ValueError("ollama_model is empty.")
        cfg["ollama_model"] = v

    _save_config(cfg)
    return cfg


def probe_ollama() -> dict:
    """Return {available: bool, models: [...], error?: str} for the configured Ollama endpoint."""
    base = get_ollama_base_url()
    try:
        with httpx.Client(timeout=3.0) as client:
            r = client.get(f"{base}/api/tags")
        if r.status_code != 200:
            return {"available": False, "models": [], "error": f"HTTP {r.status_code} from {base}"}
        data = r.json() or {}
        models = [m.get("name") for m in (data.get("models") or []) if m.get("name")]
        return {"available": True, "models": models}
    except httpx.HTTPError as e:
        return {"available": False, "models": [], "error": str(e)}


# ---------- JSON extraction ----------

def _extract_episodes(content: str) -> list[dict]:
    try:
        parsed = json.loads(content)
        if isinstance(parsed, dict) and isinstance(parsed.get("episodes"), list):
            return parsed["episodes"]
        if isinstance(parsed, list):
            return parsed
    except Exception:
        pass

    obj_start = content.find("{")
    obj_end = content.rfind("}")
    if obj_start != -1 and obj_end > obj_start:
        try:
            parsed = json.loads(content[obj_start:obj_end + 1])
            if isinstance(parsed, dict) and isinstance(parsed.get("episodes"), list):
                return parsed["episodes"]
        except Exception:
            pass

    arr_start = content.find("[")
    arr_end = content.rfind("]")
    if arr_start != -1 and arr_end > arr_start:
        try:
            parsed = json.loads(content[arr_start:arr_end + 1])
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass

    raise ValueError(f"LLM returned unexpected format: {content[:300]}")


# ---------- Provider calls (OpenAI-compatible for both) ----------

def _call_openai_compatible(
    *,
    base_url: str,
    path: str,
    model: str,
    system: str,
    user: str,
    api_key: str | None,
    provider_label: str,
    timeout: float = 300.0,
) -> str:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    url = f"{base_url.rstrip('/')}{path}"
    try:
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as e:
        raise LLMApiError(f"{provider_label} request failed: {e}") from e

    if resp.status_code in (401, 403):
        raise MissingApiKeyError(
            f"{provider_label} rejected the credentials (HTTP {resp.status_code}). "
            "Open Settings and check your key."
        )
    if resp.status_code == 404:
        # Ollama returns 404 when the model isn't pulled locally.
        snippet = resp.text[:400].replace("\n", " ")
        raise LLMApiError(
            f"{provider_label} 404: {snippet}\n"
            f"For Ollama, pull the model first (e.g. `ollama pull {model}`)."
        )
    if resp.status_code >= 400:
        snippet = resp.text[:500].replace("\n", " ")
        raise LLMApiError(f"{provider_label} error {resp.status_code}: {snippet}")

    try:
        data = resp.json()
        return data["choices"][0]["message"]["content"]
    except Exception as e:
        raise LLMApiError(f"Unexpected {provider_label} response shape: {e}") from e


def _run_deepseek(system: str, user: str) -> str:
    api_key = get_deepseek_api_key()
    if not api_key:
        raise MissingApiKeyError(
            "DeepSeek API key not set. Open Settings and paste your key "
            "from https://platform.deepseek.com/api_keys."
        )
    return _call_openai_compatible(
        base_url=DEEPSEEK_BASE_URL,
        path="/chat/completions",
        model=active_model(),
        system=system,
        user=user,
        api_key=api_key,
        provider_label="DeepSeek",
    )


def _run_ollama(system: str, user: str) -> str:
    base = get_ollama_base_url()
    probe = probe_ollama()
    if not probe.get("available"):
        raise MissingApiKeyError(
            f"Can't reach Ollama at {base}. "
            "Install from https://ollama.com and start it (`ollama serve`), "
            f"then set the model in Settings. Error: {probe.get('error', 'unknown')}"
        )
    model = get_ollama_model()
    installed = probe.get("models") or []
    # Ollama tag names are `family:tag`; accept either exact match or family prefix.
    def _matches(name: str) -> bool:
        return name == model or name.split(":", 1)[0] == model.split(":", 1)[0]
    if installed and not any(_matches(m) for m in installed):
        raise MissingApiKeyError(
            f"Ollama model '{model}' isn't installed. "
            f"Available: {', '.join(installed) or '(none)'}. "
            f"Run `ollama pull {model}` or pick another in Settings."
        )
    return _call_openai_compatible(
        base_url=base,
        path="/v1/chat/completions",
        model=model,
        system=system,
        user=user,
        api_key=None,
        provider_label="Ollama",
    )


# ---------- Public entrypoint ----------

def chunk_video(transcript: list[dict], total_duration: float) -> list[dict]:
    transcript_text = format_transcript_for_claude(transcript)
    max_chars = 150_000
    if len(transcript_text) > max_chars:
        transcript_text = transcript_text[:max_chars] + "\n[transcript truncated]"

    user_prompt = (
        f"Break this educational video transcript into logical learning episodes.\n\n"
        f"Total duration: {total_duration:.0f} seconds ({total_duration / 60:.1f} minutes)\n\n"
        f"Transcript:\n{transcript_text}\n\n"
        f"Respond with ONLY the JSON object described in the system prompt."
    )

    provider = get_provider()
    if provider == "ollama":
        content = _run_ollama(SYSTEM_PROMPT, user_prompt)
    else:
        content = _run_deepseek(SYSTEM_PROMPT, user_prompt)

    chunks = _extract_episodes(content)
    if not chunks:
        raise LLMApiError(f"{provider} returned zero episodes.")

    chunks[-1]["end_time"] = total_duration
    return chunks
