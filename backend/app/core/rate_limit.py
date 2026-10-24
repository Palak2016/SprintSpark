"""Small in-process sliding-window rate limiter for unauthenticated auth
endpoints (OTP, signup, invitation preview).

Limits are kept in memory per server process. If the API runs with several
worker processes, each worker keeps its own counters; put a shared limiter
(for example at the reverse proxy) in front for stricter guarantees.
"""

import threading
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request, status

_lock = threading.Lock()
_hits: Dict[str, Deque[float]] = defaultdict(deque)

RATE_LIMITED_DETAIL = "Too many requests. Please wait a few minutes and try again."


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def enforce(key: str, limit: int, window_seconds: int) -> None:
    now = time.monotonic()
    with _lock:
        bucket = _hits[key]
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=RATE_LIMITED_DETAIL,
            )
        bucket.append(now)


def reset() -> None:
    """Clear all counters (used by tests)."""
    with _lock:
        _hits.clear()
