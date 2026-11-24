"""Filter AI-generated task actions before they are shown to users."""

from typing import Any, Iterable, List


GENERIC_PHRASES = (
    "improve productivity",
    "manage your time",
    "stay focused",
    "work harder",
    "communicate better",
)
MANAGER_ESCALATION_PHRASES = (
    "ask your manager",
    "contact your manager",
    "tell your manager",
    "escalate to your manager",
    "get manager approval",
)


def _specific_actions(
    actions: Iterable[Any],
    *,
    exclude_manager_escalation: bool = False,
) -> List[str]:
    result: List[str] = []
    for action in actions:
        if not isinstance(action, str):
            continue
        cleaned = " ".join(action.split()).strip(" -")
        if len(cleaned) < 12 or any(phrase in cleaned.lower() for phrase in GENERIC_PHRASES):
            continue
        if exclude_manager_escalation and any(
            phrase in cleaned.lower() for phrase in MANAGER_ESCALATION_PHRASES
        ):
            continue
        if cleaned not in result:
            result.append(cleaned[:300])
        if len(result) == 5:
            break
    return result


def recovery_actions(
    task: Any,
    update: Any,
    ai_actions: Iterable[Any] = (),
) -> List[str]:
    project = getattr(task, "project", None)
    manager_self_report = (
        getattr(project, "manager_id", None) is not None
        and getattr(project, "manager_id", None) == getattr(update, "user_id", None)
    )
    return _specific_actions(
        ai_actions,
        exclude_manager_escalation=manager_self_report,
    )
