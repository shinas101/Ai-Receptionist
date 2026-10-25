from pathlib import Path
from gcsa.event import Event
from gcsa.google_calendar import GoogleCalendar
from gcsa.recurrence import Recurrence, DAILY, SU, SA
from beautiful_date import Jan, Apr

CREDENTIALS_PATH = Path(__file__).parent / "credentials" / "credentials.json"

calendar = GoogleCalendar('primary', credentials_path=str(CREDENTIALS_PATH))
event = Event(
    'Breakfast',
    start=(1 / Jan / 2026)[9:00],
    recurrence=[
        Recurrence.rule(freq=DAILY),
        Recurrence.exclude_rule(by_week_day=[SU, SA]),
        Recurrence.exclude_times([
            (19 / Apr / 2026)[9:00],
            (22 / Apr / 2026)[9:00]
        ])
    ],
    minutes_before_email_reminder=50
)

calendar.add_event(event)

for event in calendar:
    print(event)