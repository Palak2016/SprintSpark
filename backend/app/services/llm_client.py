"""Minimal JSON-mode client for the LLM providers already configured in
``app.core.config`` (``OPENAI_API_KEY`` / ``GEMINI_API_KEY``).

It uses only the standard library so no provider SDK is required. API keys
are sent in request headers only and never appear in errors, logs or
results.
"""

from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

RETIRED_GEMINI_MODELS = {
    "gemini-2.0-flash": "gemini-3.6-flash",
    "gemini-2.0-flash-001": "gemini-3.6-flash",
}
GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite"
GEMINI_FALLBACK_TIMEOUT_SECONDS = 12.0


class LLMError(Exception):
    """Raised when a model call cannot produce a usable JSON answer."""

    def __init__(self, category: str, message: str, provider: Optional[str] = None,
                 model: Optional[str] = None, latency_ms: Optional[int] = None,
                 status_code: Optional[int] = None):
        super().__init__(message)
        self.category = category  # NOT_CONFIGURED | TIMEOUT | HTTP_ERROR | INVALID_RESPONSE | NETWORK_ERROR
        self.message = message
        self.provider = provider
        self.model = model
        self.latency_ms = latency_ms
        self.status_code = status_code


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


def resolve_configs() -> List[LLMConfig]:
    """Return configured providers with the preferred provider first."""
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
    if settings.WAYJET_API_KEY:
        candidates.append(LLMConfig(
            provider="wayjet",
            model=settings.WAYJET_MODEL,
            api_key=settings.WAYJET_API_KEY,
            base_url=settings.WAYJET_BASE_URL.rstrip("/"),
            timeout=settings.LLM_TIMEOUT_SECONDS,
        ))
    if settings.GEMINI_API_KEY:
        configured_model = (settings.GEMINI_MODEL or "").strip()
        model = RETIRED_GEMINI_MODELS.get(
            configured_model.lower(),
            configured_model,
        )
        if model != configured_model:
            logger.warning(
                "Gemini model %s is retired; using %s instead.",
                configured_model,
                model,
            )
        candidates.append(LLMConfig(
            provider="gemini",
            model=model,
            api_key=settings.GEMINI_API_KEY,
            base_url="https://generativelanguage.googleapis.com/v1beta",
            timeout=settings.LLM_TIMEOUT_SECONDS,
        ))
    if not candidates:
        return []
    if preferred:
        primary = next(
            (candidate for candidate in candidates if candidate.provider == preferred),
            None,
        )
        if primary is None:
            return []
        return [primary, *(candidate for candidate in candidates if candidate is not primary)]
    return candidates


def resolve_config() -> Optional[LLMConfig]:
    """Pick the preferred configured provider, or ``None`` when no key is set."""
    candidates = resolve_configs()
    return candidates[0] if candidates else None


def describe_config() -> Dict[str, Any]:
    configs = resolve_configs()
    if not configs:
        return {
            "configured": False,
            "provider": None,
            "model": None,
            "fallback_providers": [],
        }
    return {
        "configured": True,
        "provider": configs[0].provider,
        "model": configs[0].model,
        "fallback_providers": [config.provider for config in configs[1:]],
    }


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


def _request_with_503_retry(
    transport: Transport,
    url: str,
    body: Dict[str, Any],
    headers: Dict[str, str],
    timeout: float,
    provider: str,
) -> Dict[str, Any]:
    try:
        return transport(url, body, headers, timeout)
    except urllib.error.HTTPError as error:
        if error.code != 503:
            raise
        logger.warning("%s returned HTTP 503; retrying the request once.", provider)
        error.close()
        time.sleep(0.5)
        return transport(url, body, headers, timeout)


def _is_timeout_failure(error: BaseException) -> bool:
    if isinstance(error, TimeoutError):
        return True
    return (
        isinstance(error, urllib.error.URLError)
        and isinstance(getattr(error, "reason", None), TimeoutError)
    )


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


def _call_json_model_with_config(
    system_prompt: str,
    user_prompt: str,
    transport: Transport,
    config: LLMConfig,
) -> LLMResult:
    """Call one provider and normalize its response."""
    started = time.monotonic()
    model_name = config.model
    fallback_from_model = None
    fallback_trigger = None
    try:
        if config.provider in {"openai", "wayjet"}:
            payload = _request_with_503_retry(
                transport,
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
                config.provider,
            )
            text = payload["choices"][0]["message"]["content"]
            model = payload.get("model") or config.model
            usage = payload.get("usage") or {}
        elif config.provider == "gemini":
            request_body = {
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
                "generationConfig": {
                    "temperature": 0.2,
                    "responseMimeType": "application/json",
                },
            }
            headers = {"x-goog-api-key": config.api_key}
            try:
                payload = _request_with_503_retry(
                    transport,
                    f"{config.base_url}/models/{model_name}:generateContent",
                    request_body,
                    headers,
                    config.timeout,
                    config.provider,
                )
            except (urllib.error.HTTPError, TimeoutError, urllib.error.URLError) as error:
                is_retryable_503 = isinstance(error, urllib.error.HTTPError) and error.code == 503
                is_timeout = _is_timeout_failure(error)
                if (
                    not (is_retryable_503 or is_timeout)
                    or model_name == GEMINI_FALLBACK_MODEL
                ):
                    raise
                fallback_from_model = model_name
                fallback_trigger = "HTTP 503" if is_retryable_503 else "timeout"
                model_name = GEMINI_FALLBACK_MODEL
                if isinstance(error, urllib.error.HTTPError):
                    error.close()
                logger.warning(
                    "Gemini model %s failed with %s; trying %s.",
                    fallback_from_model,
                    fallback_trigger,
                    model_name,
                )
                payload = _request_with_503_retry(
                    transport,
                    f"{config.base_url}/models/{model_name}:generateContent",
                    request_body,
                    headers,
                    min(config.timeout, GEMINI_FALLBACK_TIMEOUT_SECONDS),
                    config.provider,
                )
            text = payload["candidates"][0]["content"]["parts"][0]["text"]
            model = payload.get("modelVersion") or model_name
            usage = payload.get("usageMetadata") or {}
        else:
            raise LLMError("NOT_CONFIGURED", f"Unsupported LLM provider '{config.provider}'.")
    except LLMError:
        raise
    except urllib.error.HTTPError as exc:
        error_code = None
        try:
            response_body = json.loads(exc.read().decode("utf-8"))
            provider_error = response_body.get("error", {})
            error_code = (
                provider_error.get("code") or provider_error.get("type")
                if isinstance(provider_error, dict)
                else None
            )
        except (AttributeError, UnicodeDecodeError, json.JSONDecodeError, OSError, ValueError):
            pass

        if exc.code == 402:
            category = "PAYMENT_REQUIRED"
            message = (
                f"{config.provider.title()} requires an active balance or billing setup. "
                "Add funds or review the API key's spending budget, then retry."
            )
        elif exc.code == 429 and str(error_code).lower() in {
            "insufficient_quota",
            "billing_hard_limit_reached",
            "budget_exceeded",
        }:
            category = "QUOTA_EXCEEDED"
            message = (
                f"{config.provider.title()} API quota is exhausted or a usage limit was reached. "
                "Check billing, project budget, and organization usage limits."
            )
        elif exc.code == 429:
            category = "RATE_LIMITED"
            message = (
                f"{config.provider.title()} rate limit reached. Wait briefly before retrying; "
                "if it persists, check your project rate limits."
            )
        else:
            category = "HTTP_ERROR"
            if fallback_from_model:
                message = (
                    f"Gemini model {fallback_from_model} failed with {fallback_trigger}; "
                    f"fallback model {model_name} returned HTTP {exc.code}."
                )
            else:
                message = f"{config.provider} model {model_name} returned HTTP {exc.code}."

        raise LLMError(
            category,
            message,
            config.provider, config.model, int((time.monotonic() - started) * 1000),
            status_code=exc.code,
        ) from None
    except TimeoutError:
        message = (
            f"Gemini model {fallback_from_model} failed with {fallback_trigger}; "
            f"fallback model {model_name} timed out after "
            f"{min(config.timeout, GEMINI_FALLBACK_TIMEOUT_SECONDS):g}s."
            if fallback_from_model
            else f"{config.provider} model {model_name} did not respond within {config.timeout:g}s."
        )
        raise LLMError(
            "TIMEOUT",
            message,
            config.provider, config.model, int((time.monotonic() - started) * 1000),
        ) from None
    except urllib.error.URLError as exc:
        reason = getattr(exc, "reason", None)
        category = "TIMEOUT" if isinstance(reason, TimeoutError) else "NETWORK_ERROR"
        message = (
            f"Gemini model {fallback_from_model} failed with {fallback_trigger}; "
            f"fallback model {model_name} timed out after "
            f"{min(config.timeout, GEMINI_FALLBACK_TIMEOUT_SECONDS):g}s."
            if category == "TIMEOUT" and fallback_from_model
            else f"Could not reach {config.provider}: {type(reason).__name__ if reason else 'network error'}."
        )
        raise LLMError(
            category,
            message,
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


def _is_retryable_provider_failure(error: LLMError) -> bool:
    return (
        error.category in {"TIMEOUT", "NETWORK_ERROR", "RATE_LIMITED"}
        or error.status_code is not None
        and 500 <= error.status_code < 600
    )


def call_json_model(
    system_prompt: str,
    user_prompt: str,
    transport: Transport = _post_json,
    config: Optional[LLMConfig] = None,
) -> LLMResult:
    """Try the preferred provider, then configured backups for transient failures."""
    configs = [config] if config is not None else resolve_configs()
    if not configs:
        raise LLMError(
            "NOT_CONFIGURED",
            "No LLM is configured. Set OPENAI_API_KEY, WAYJET_API_KEY, or GEMINI_API_KEY in backend/.env.",
        )

    started = time.monotonic()
    failures = []
    for index, provider_config in enumerate(configs):
        try:
            result = _call_json_model_with_config(
                system_prompt,
                user_prompt,
                transport,
                provider_config,
            )
            result.latency_ms = int((time.monotonic() - started) * 1000)
            return result
        except LLMError as error:
            failures.append(error)
            has_backup = config is None and index + 1 < len(configs)
            if not has_backup or not _is_retryable_provider_failure(error):
                break
            logger.warning(
                "%s model %s failed with %s; trying configured provider %s.",
                provider_config.provider,
                provider_config.model,
                error.category,
                configs[index + 1].provider,
            )

    latency_ms = int((time.monotonic() - started) * 1000)
    if len(failures) == 1:
        failures[0].latency_ms = latency_ms
        raise failures[0]

    last_error = failures[-1]
    attempt_details = "; ".join(
        f"{error.provider or configs[index].provider} model "
        f"{error.model or configs[index].model}: {error.message}"
        for index, error in enumerate(failures)
    )
    raise LLMError(
        last_error.category,
        f"All configured LLM providers failed. {attempt_details}",
        last_error.provider,
        last_error.model,
        latency_ms,
        status_code=last_error.status_code,
    ) from None
