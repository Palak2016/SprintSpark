"""Minimal JSON-mode client for the LLM providers already configured in
``app.core.config`` (``OPENAI_API_KEY`` / ``GEMINI_API_KEY``).

It uses only the standard library so no provider SDK is required. API keys
are sent in request headers only and never appear in errors, logs or
results.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional

from app.core.config import settings


class LLMError(Exception):
    """Raised when a model call cannot produce a usable JSON answer."""

    def __init__(self, category: str, message: str, provider: Optional[str] = None,
                 model: Optional[str] = None, latency_ms: Optional[int] = None):
        super().__init__(message)
        self.category = category  # NOT_CONFIGURED | TIMEOUT | HTTP_ERROR | INVALID_RESPONSE | NETWORK_ERROR
        self.message = message
        self.provider = provider
        self.model = model
        self.latency_ms = latency_ms


@dataclass
class LLMResult:
    provider: str
    model: str
    content: Dict[str, Any]
    latency_ms: int
    usage: Dict[str, Any] = field(default_factory=dict)


@dataclass
class LLMConfig:
    provider: str
    model: str
    api_key: str
    base_url: str
    timeout: float


def resolve_config() -> Optional[LLMConfig]:
    """Pick the configured provider, or ``None`` when no key is set."""
    preferred = (settings.LLM_PROVIDER or "").strip().lower()
    candidates = []
    if settings.OPENAI_API_KEY:
        candidates.append(LLMConfig(
            provider="openai",
            model=settings.OPENAI_MODEL,
            api_key=settings.OPENAI_API_KEY,
            base_url=settings.OPENAI_BASE_URL.rstrip("/"),
            timeout=settings.LLM_TIMEOUT_SECONDS,
        ))
    if settings.GEMINI_API_KEY:
        candidates.append(LLMConfig(
            provider="gemini",
            model=settings.GEMINI_MODEL,
            api_key=settings.GEMINI_API_KEY,
            base_url="https://generativelanguage.googleapis.com/v1beta",
            timeout=settings.LLM_TIMEOUT_SECONDS,
        ))
    if not candidates:
        return None
    if preferred:
        for candidate in candidates:
            if candidate.provider == preferred:
                return candidate
        return None
    return candidates[0]


def describe_config() -> Dict[str, Any]:
    config = resolve_config()
    if config is None:
        return {"configured": False, "provider": None, "model": None}
    return {"configured": True, "provider": config.provider, "model": config.model}


def _post_json(url: str, body: Dict[str, Any], headers: Dict[str, str], timeout: float) -> Dict[str, Any]:
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310 - fixed https hosts
        return json.loads(response.read().decode("utf-8"))


Transport = Callable[[str, Dict[str, Any], Dict[str, str], float], Dict[str, Any]]


def _parse_json_text(text: str) -> Dict[str, Any]:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    parsed = json.loads(cleaned)
    if not isinstance(parsed, dict):
        raise ValueError("Top-level JSON value is not an object")
    return parsed


def call_json_model(
    system_prompt: str,
    user_prompt: str,
    transport: Transport = _post_json,
    config: Optional[LLMConfig] = None,
) -> LLMResult:
    """Ask the configured model for a JSON object."""
    config = config or resolve_config()
    if config is None:
        raise LLMError(
            "NOT_CONFIGURED",
            "No LLM is configured. Set OPENAI_API_KEY or GEMINI_API_KEY in backend/.env.",
        )

    started = time.monotonic()
    try:
        if config.provider == "openai":
            payload = transport(
                f"{config.base_url}/chat/completions",
                {
                    "model": config.model,
                    "temperature": 0.2,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                },
                {"Authorization": f"Bearer {config.api_key}"},
                config.timeout,
            )
            text = payload["choices"][0]["message"]["content"]
            model = payload.get("model") or config.model
            usage = payload.get("usage") or {}
        elif config.provider == "gemini":
            payload = transport(
                f"{config.base_url}/models/{config.model}:generateContent",
                {
                    "systemInstruction": {"parts": [{"text": system_prompt}]},
                    "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                    "generationConfig": {
                        "temperature": 0.2,
                        "responseMimeType": "application/json",
                    },
                },
                {"x-goog-api-key": config.api_key},
                config.timeout,
            )
            text = payload["candidates"][0]["content"]["parts"][0]["text"]
            model = payload.get("modelVersion") or config.model
            usage = payload.get("usageMetadata") or {}
        else:
            raise LLMError("NOT_CONFIGURED", f"Unsupported LLM provider '{config.provider}'.")
    except LLMError:
        raise
    except urllib.error.HTTPError as exc:
        raise LLMError(
            "HTTP_ERROR",
            f"{config.provider} returned HTTP {exc.code}.",
            config.provider, config.model, int((time.monotonic() - started) * 1000),
        ) from None
    except TimeoutError:
        raise LLMError(
            "TIMEOUT",
            f"{config.provider} did not respond within {config.timeout:g}s.",
            config.provider, config.model, int((time.monotonic() - started) * 1000),
        ) from None
    except urllib.error.URLError as exc:
        reason = getattr(exc, "reason", None)
        category = "TIMEOUT" if isinstance(reason, TimeoutError) else "NETWORK_ERROR"
        raise LLMError(
            category,
            f"Could not reach {config.provider}: {type(reason).__name__ if reason else 'network error'}.",
            config.provider, config.model, int((time.monotonic() - started) * 1000),
        ) from None
    except (KeyError, IndexError, TypeError, ValueError):
        raise LLMError(
            "INVALID_RESPONSE",
            f"{config.provider} returned a response without the expected content.",
            config.provider, config.model, int((time.monotonic() - started) * 1000),
        ) from None

    latency_ms = int((time.monotonic() - started) * 1000)
    try:
        content = _parse_json_text(text)
    except (ValueError, json.JSONDecodeError):
        raise LLMError(
            "INVALID_RESPONSE",
            f"{config.provider} did not return valid JSON.",
            config.provider, model, latency_ms,
        ) from None

    safe_usage = {k: v for k, v in usage.items() if isinstance(v, (int, float))}
    return LLMResult(config.provider, model, content, latency_ms, safe_usage)
