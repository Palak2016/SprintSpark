from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, PlainSerializer


def normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        # Legacy database timestamp columns contain UTC wall-clock values.
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


UTCDateTime = Annotated[
    datetime,
    AfterValidator(normalize_utc),
    PlainSerializer(
        lambda value: normalize_utc(value).isoformat(),
        return_type=str,
        when_used="json",
    ),
]
