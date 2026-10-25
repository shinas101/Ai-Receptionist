import json
from pathlib import Path
from typing import Any, Dict

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
SETTINGS_FILE = DATA_DIR / "settings.json"

DEFAULT_SETTINGS: Dict[str, Any] = {
    "google_calendar_enabled": False,  # Default to False: keeping Google aside by default!
    "admin_pin": "admin123",
    "clinic_name": "ABC Health Care",
    "working_hours": "09:00 - 17:00",
    "slot_duration_minutes": 30,
    "timezone": "Asia/Kolkata",
    "sync_on_booking": True,
}


def _ensure_data_dir():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_SETTINGS, f, indent=2)


def get_all_settings() -> Dict[str, Any]:
    """Retrieve all clinic configuration settings."""
    _ensure_data_dir()
    try:
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            # Ensure defaults for any missing keys
            merged = {**DEFAULT_SETTINGS, **data}
            return merged
    except Exception:
        return DEFAULT_SETTINGS.copy()


def get_setting(key: str, default: Any = None) -> Any:
    """Get a single setting by key."""
    settings = get_all_settings()
    return settings.get(key, default if default is not None else DEFAULT_SETTINGS.get(key))


def set_setting(key: str, value: Any) -> Dict[str, Any]:
    """Update a setting by key and persist to settings.json."""
    _ensure_data_dir()
    settings = get_all_settings()
    settings[key] = value
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)
    return settings


def is_google_calendar_enabled() -> bool:
    """Check if Google Calendar syncing is currently enabled."""
    val = get_setting("google_calendar_enabled", False)
    if isinstance(val, str):
        return val.lower() in ("true", "1", "yes", "on")
    return bool(val)


def set_google_calendar_enabled(enabled: bool) -> bool:
    """Turn Google Calendar integration ON or OFF."""
    set_setting("google_calendar_enabled", bool(enabled))
    return bool(enabled)


def verify_admin_pin(pin: str) -> bool:
    """Verify administrator PIN."""
    current_pin = str(get_setting("admin_pin", "admin123")).strip()
    return str(pin).strip() == current_pin
