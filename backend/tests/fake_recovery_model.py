import json
from datetime import date, timedelta

from app.services.llm_client import LLMResult


def fake_recovery_model(_system_prompt, user_prompt):
    facts = json.loads(user_prompt.split(":\n", 1)[1])
    today = date.fromisoformat(facts["today"])
    notes_by_task = {}
    for note in facts.get("employee_notes", []):
        notes_by_task.setdefault(note.get("task_id"), []).append(note.get("note", ""))

    actions = []
    for task in facts.get("tasks", []):
        task_id = task["id"]
        if task.get("is_blocked") or task.get("status") == "BLOCKED":
            context = " ".join(notes_by_task.get(task_id, []))
            blocker = task.get("blocker_reason") or context or "Resolve the reported dependency."
            actions.append({
                "action_type": "ESCALATE_BLOCKER",
                "task_id": task_id,
                "proposed_values": {"blocker_reason": blocker},
                "reason": f"Resolve the task blocker before dependent work proceeds. {context}",
                "expected_impact": "Unblocks the team once the dependency is verified.",
            })
        elif (
            task.get("due_date") not in {None, "None"}
            and date.fromisoformat(task["due_date"]) < today
            and task.get("status") != "COMPLETED"
        ):
            actions.append({
                "action_type": "EXTEND_DEADLINE",
                "task_id": task_id,
                "proposed_values": {"due_date": (today + timedelta(days=5)).isoformat()},
                "reason": "The task is overdue and still has work remaining.",
                "expected_impact": "Provides a realistic recovery date for the remaining work.",
            })
        if len(actions) >= 8:
            break

    if not actions:
        task = next(
            (item for item in facts.get("tasks", []) if item.get("status") != "COMPLETED"),
            None,
        )
        if task:
            actions.append({
                "action_type": "SPLIT_EFFORT",
                "task_id": task["id"],
                "proposed_values": {
                    "note": f"Confirm the next deliverable and remaining effort for {task['title']}."
                },
                "reason": "A task-specific check-in will clarify the next achievable step.",
                "expected_impact": "Makes the remaining work and ownership explicit.",
            })

    content = {
        "delay_explanation": "The recovery actions are based on current task, schedule, and update data.",
        "strategies": [{
            "strategy_id": "S1",
            "name": "Sprint Recovery - AI test plan",
            "approach": "MIXED",
            "summary": "Address the current project risks using validated, task-specific steps.",
            "benefits": ["Focuses on the active risks"],
            "trade_offs": [],
            "assumptions": [],
            "risks": [],
            "actions": actions,
        }],
        "recommended_strategy_id": "S1",
        "recommendation_reason": "This plan addresses the current risks without applying changes automatically.",
    }
    return LLMResult("openai", "gpt-test", content, 1)
