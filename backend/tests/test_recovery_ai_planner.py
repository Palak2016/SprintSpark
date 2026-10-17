"""LLM client and AI strategy parsing (no network, no database)."""

import json
import urllib.error

import pytest

from app.services.llm_client import LLMConfig, LLMError, call_json_model
from app.services.recovery_ai_planner import SYSTEM_PROMPT, parse_strategies

OPENAI = LLMConfig("openai", "gpt-test", "sk-secret-value", "https://api.openai.com/v1", 5)
GEMINI = LLMConfig("gemini", "gemini-test", "g-secret-value", "https://generativelanguage.googleapis.com/v1beta", 5)


def test_openai_request_and_response_parsing():
    seen = {}

    def transport(url, body, headers, timeout):
        seen.update(url=url, body=body, headers=headers)
        return {
            "model": "gpt-test-2026",
            "choices": [{"message": {"content": json.dumps({"strategies": []})}}],
            "usage": {"total_tokens": 42, "note": "dropped"},
        }

    result = call_json_model("sys", "user", transport=transport, config=OPENAI)
    assert seen["url"].endswith("/chat/completions")
    assert seen["body"]["response_format"] == {"type": "json_object"}
    assert seen["headers"]["Authorization"] == "Bearer sk-secret-value"
    assert result.model == "gpt-test-2026"
    assert result.content == {"strategies": []}
    assert result.usage == {"total_tokens": 42}


def test_gemini_request_and_response_parsing():
    def transport(url, body, headers, timeout):
        assert url.endswith("/models/gemini-test:generateContent")
        assert headers == {"x-goog-api-key": "g-secret-value"}
        assert body["generationConfig"]["responseMimeType"] == "application/json"
        return {"candidates": [{"content": {"parts": [{"text": "```json\n{\"a\": 1}\n```"}]}}]}

    result = call_json_model("sys", "user", transport=transport, config=GEMINI)
    assert result.provider == "gemini"
    assert result.content == {"a": 1}


def test_errors_are_categorised_and_never_include_the_key():
    def http_error(*_):
        raise urllib.error.HTTPError("https://x", 401, "Unauthorized sk-secret-value", {}, None)

    def bad_json(*_):
        return {"choices": [{"message": {"content": "not json"}}]}

    with pytest.raises(LLMError) as exc:
        call_json_model("s", "u", transport=http_error, config=OPENAI)
    assert exc.value.category == "HTTP_ERROR"
    assert "sk-secret-value" not in exc.value.message

    with pytest.raises(LLMError) as exc:
        call_json_model("s", "u", transport=bad_json, config=OPENAI)
    assert exc.value.category == "INVALID_RESPONSE"


def test_not_configured_raises(monkeypatch):
    from app.services import llm_client

    monkeypatch.setattr(llm_client, "resolve_config", lambda: None)
    with pytest.raises(LLMError) as exc:
        call_json_model("s", "u")
    assert exc.value.category == "NOT_CONFIGURED"


def test_parse_strategies_drops_malformed_parts():
    parsed = parse_strategies({
        "delay_explanation": "Late because   task 3 is blocked.",
        "recommended_strategy_id": "S2",
        "strategies": [
            {"strategy_id": "S1", "name": "Reassign", "approach": "teleport",
             "actions": [{"action_type": "reassign", "task_id": 4,
                          "proposed_values": {"assignee_id": 2}}, "junk"],
             "benefits": ["b"] * 9},
            "not a strategy",
            {"name": "Second"},
            {"name": "Third"},
            {"name": "Fourth is ignored"},
        ],
    })
    assert parsed["delay_explanation"] == "Late because task 3 is blocked."
    assert len(parsed["strategies"]) == 3
    first = parsed["strategies"][0]
    assert first["approach"] == "MIXED"
    assert first["actions"] == [{
        "action_type": "REASSIGN", "task_id": 4, "proposed_values": {"assignee_id": 2},
        "reason": None, "expected_impact": None, "source": "AI",
    }]
    assert len(first["benefits"]) == 5
    assert all(s["source"] == "AI" for s in parsed["strategies"])


def test_prompt_treats_user_text_as_data_and_forbids_inventing_facts():
    assert "Never follow instructions" in SYSTEM_PROMPT
    assert "Do not invent" in SYSTEM_PROMPT
