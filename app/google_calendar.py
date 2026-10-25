import asyncio
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, List, Optional

from app.settings import is_google_calendar_enabled

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
CALENDAR_ID = "primary"
CREDENTIALS_PATH = BASE_DIR / "credentials" / "credentials.json"
TOKEN_PATH = BASE_DIR / "credentials" / "token.pickle"

_calendar_instance = None


class MockLocalEvent:
    """Lightweight event container returned when operating in local mode (Google Calendar OFF)."""
    def __init__(
        self,
        summary: str,
        start: datetime,
        end: datetime,
        description: Optional[str] = None,
        location: Optional[str] = None,
        event_id: Optional[str] = None,
    ):
        self.id = event_id or f"LOCAL-{uuid.uuid4().hex[:8].upper()}"
        self.summary = summary
        self.start = start
        self.end = end
        self.description = description
        self.location = location

    def __repr__(self):
        return f"<MockLocalEvent id={self.id} summary={self.summary} start={self.start}>"


def _get_google_calendar():
    """Lazy initialize Google Calendar client if credentials exist."""
    global _calendar_instance
    if _calendar_instance is not None:
        return _calendar_instance

    try:
        from gcsa.google_calendar import GoogleCalendar
        if CREDENTIALS_PATH.exists():
            _calendar_instance = GoogleCalendar(
                default_calendar=CALENDAR_ID,
                credentials_path=str(CREDENTIALS_PATH),
                token_path=str(TOKEN_PATH) if TOKEN_PATH.exists() else None,
            )
            return _calendar_instance
    except Exception as e:
        logger.warning(f"Google Calendar client initialization skipped: {e}")

    return None


def get_events(start: datetime, end: datetime) -> List[Any]:
    """Retrieve events between start and end. If Google Calendar is disabled, returns local events."""
    if not is_google_calendar_enabled():
        # Google Calendar is OFF: fetch from local clinic database
        from app.memory.service import get_all_appointments
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                appts = []  # Can't nested run in running loop synchronously
            else:
                appts = loop.run_until_complete(get_all_appointments())
        except Exception:
            appts = []

        local_events = []
        for a in appts:
            if a.get("status") == "cancelled":
                continue
            try:
                a_start = datetime.fromisoformat(a["start_time"])
                a_end = datetime.fromisoformat(a["end_time"])
                if a_start < end and a_end > start:
                    local_events.append(MockLocalEvent(
                        summary=f"ABC Health Care: {a.get('patient_name', 'Patient')} ({a.get('doctor_name', 'Doctor')})",
                        start=a_start,
                        end=a_end,
                        description=a.get("reason", ""),
                        event_id=a.get("calendar_event_id"),
                    ))
            except Exception:
                continue
        return local_events

    cal = _get_google_calendar()
    if cal:
        try:
            return list(cal.get_events(time_min=start, time_max=end))
        except Exception as e:
            logger.warning(f"Google Calendar get_events error: {e}")
            return []
    return []


def is_available(start: datetime, end: datetime) -> bool:
    """Check availability. Respects Google Calendar ON/OFF setting."""
    if not is_google_calendar_enabled():
        # Google Calendar is OFF: availability is managed 100% by local appointments
        return len(get_events(start, end)) == 0

    cal = _get_google_calendar()
    if cal:
        try:
            events = list(cal.get_events(time_min=start, time_max=end))
            return len(events) == 0
        except Exception as e:
            logger.warning(f"Google Calendar is_available check failed ({e}). Checking local appointments.")
            return len(get_events(start, end)) == 0
    return len(get_events(start, end)) == 0


def create_event(
    summary: str,
    start: datetime,
    end: datetime,
    description: Optional[str] = None,
    attendee_email: Optional[str] = None,
    location: Optional[str] = None,
) -> Any:
    """Create calendar event. If Google Calendar is OFF, creates a local event token."""
    if not is_google_calendar_enabled():
        logger.info("Google Calendar is disabled. Creating local appointment reference.")
        return MockLocalEvent(
            summary=summary,
            start=start,
            end=end,
            description=description,
            location=location,
        )

    cal = _get_google_calendar()
    if cal:
        try:
            from gcsa.event import Event
            from gcsa.attendee import Attendee

            event = Event(
                summary,
                start=start,
                end=end,
                description=description,
                location=location,
            )

            if attendee_email:
                event.attendees = [Attendee(attendee_email)]

            return cal.add_event(event, send_updates="all")
        except Exception as e:
            logger.warning(f"Failed to create Google Calendar event ({e}). Falling back to local event.")
            return MockLocalEvent(
                summary=summary,
                start=start,
                end=end,
                description=description,
                location=location,
            )

    return MockLocalEvent(
        summary=summary,
        start=start,
        end=end,
        description=description,
        location=location,
    )


def delete_event(event_id: str):
    """Delete event from Google Calendar if enabled."""
    if not is_google_calendar_enabled():
        logger.info(f"Google Calendar is disabled. Skipping Google Calendar delete for {event_id}.")
        return

    if str(event_id).startswith("LOCAL-"):
        return

    cal = _get_google_calendar()
    if cal:
        try:
            cal.delete_event(event_id)
        except Exception as e:
            logger.warning(f"Google Calendar delete_event error: {e}")


def update_event(
    event_id: str,
    summary: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
):
    """Update event in Google Calendar if enabled."""
    if not is_google_calendar_enabled():
        logger.info(f"Google Calendar is disabled. Skipping Google Calendar update for {event_id}.")
        return None

    if str(event_id).startswith("LOCAL-"):
        return None

    cal = _get_google_calendar()
    if cal:
        try:
            event = cal.get_event(event_id)
            if summary:
                event.summary = summary
            if start:
                event.start = start
            if end:
                event.end = end
            cal.update_event(event)
            return event
        except Exception as e:
            logger.warning(f"Google Calendar update_event error: {e}")
            return None
    return None