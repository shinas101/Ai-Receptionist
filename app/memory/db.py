import asyncio
import logging
import os
import re
import sqlite3
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, List, Optional, Sequence

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
SQLITE_DB_PATH = DATA_DIR / "clinic.db"

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5433/ai_receptionist")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Doctor seed data
SEED_DOCTORS = [
    {
        "id": "ac383c3f-49a2-4d3a-9714-12508236efec",
        "name": "Dr. Rahul Nair",
        "specialization": "General Physician",
        "degrees": "MBBS, MD (General Medicine)",
        "room": "Room 102 · Primary Care Wing",
        "experience": "12+ Years Clinical Practice",
    },
    {
        "id": "5895a431-06fb-4eb6-99d9-edad1cbfd467",
        "name": "Dr. Priya Menon",
        "specialization": "Consultant Dermatologist",
        "degrees": "MBBS, MD, DNB (Dermatology)",
        "room": "Room 205 · Specialty Dermatology",
        "experience": "9+ Years Clinical Practice",
    },
    {
        "id": "e594dc23-6b6f-4fe5-8c49-e8d31bd460de",
        "name": "Dr. Anil Kumar",
        "specialization": "Senior Cardiologist",
        "degrees": "MBBS, MD, DM (Cardiology)",
        "room": "Room 310 · Cardiac Center",
        "experience": "16+ Years Clinical Practice",
    },
]

class DictRow(dict):
    """Dictionary-like row for consistent access via key or attribute."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.__dict__ = self


class SQLiteAdapter:
    """Async wrapper around SQLite for resilient local storage."""

    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._ensure_tables()

    def _get_connection(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_tables(self):
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            cur.executescript("""
                CREATE TABLE IF NOT EXISTS doctors (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    specialization TEXT NOT NULL,
                    degrees TEXT,
                    room TEXT,
                    experience TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS customers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    phone TEXT NOT NULL UNIQUE,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS customer_memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id TEXT NOT NULL,
                    memory TEXT NOT NULL,
                    embedding TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS appointments (
                    id TEXT PRIMARY KEY,
                    customer_id TEXT NOT NULL,
                    doctor_id TEXT NOT NULL,
                    calendar_event_id TEXT UNIQUE,
                    start_time TEXT NOT NULL,
                    end_time TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'scheduled',
                    reason TEXT,
                    google_synced INTEGER DEFAULT 0,
                    notes TEXT,
                    created_at TEXT DEFAULT (datetime('now')),
                    updated_at TEXT DEFAULT (datetime('now')),
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
                    FOREIGN KEY(doctor_id) REFERENCES doctors(id) ON DELETE RESTRICT
                );

                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
            """)

            # Seed doctors if empty
            cur.execute("SELECT COUNT(*) FROM doctors")
            if cur.fetchone()[0] == 0:
                for doc in SEED_DOCTORS:
                    cur.execute("""
                        INSERT INTO doctors (id, name, specialization, degrees, room, experience)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (doc["id"], doc["name"], doc["specialization"], doc["degrees"], doc["room"], doc["experience"]))

            # Seed initial realistic appointments if empty
            cur.execute("SELECT COUNT(*) FROM appointments")
            if cur.fetchone()[0] == 0:
                self._seed_sample_data(cur)

            conn.commit()
        finally:
            conn.close()

    def _seed_sample_data(self, cur: sqlite3.Cursor):
        """Seed sample customers and appointments for instant visual fidelity in the calendar."""
        now = datetime.now()
        today = now.date()
        
        sample_patients = [
            ("c1111111-1111-1111-1111-111111111111", "Rajesh Sharma", "+91 98765 43210"),
            ("c2222222-2222-2222-2222-222222222222", "Ananya Verma", "+91 98451 23456"),
            ("c3333333-3333-3333-3333-333333333333", "Vikram Malhotra", "+91 97112 34567"),
            ("c4444444-4444-4444-4444-444444444444", "Sneha Patel", "+91 99201 87654"),
            ("c5555555-5555-5555-5555-555555555555", "Amitabh Sen", "+91 98103 45678"),
            ("c6666666-6666-6666-6666-666666666666", "Pooja Hegde", "+91 97654 32109"),
        ]

        for pid, name, phone in sample_patients:
            cur.execute("""
                INSERT OR IGNORE INTO customers (id, name, phone)
                VALUES (?, ?, ?)
            """, (pid, name, phone))

        # Sample appointments across today, tomorrow, and surrounding days
        doc_rahul = "ac383c3f-49a2-4d3a-9714-12508236efec"
        doc_priya = "5895a431-06fb-4eb6-99d9-edad1cbfd467"
        doc_anil = "e594dc23-6b6f-4fe5-8c49-e8d31bd460de"

        # Format ISO in IST (+05:30)
        def make_iso(d_offset: int, hour: int, minute: int):
            d = today + timedelta(days=d_offset)
            dt = datetime(d.year, d.month, d.day, hour, minute)
            return dt.strftime("%Y-%m-%dT%H:%M:00+05:30")

        sample_appts = [
            (
                "apt-101",
                sample_patients[0][0],
                doc_rahul,
                "LOCAL-APT-101",
                make_iso(0, 10, 0),
                make_iso(0, 10, 30),
                "confirmed",
                "Persistent seasonal cough, mild fever, and chest tightness consultation",
                "Patient requested morning slot. Vital signs normal on previous visit.",
                0
            ),
            (
                "apt-102",
                sample_patients[1][0],
                doc_priya,
                "LOCAL-APT-102",
                make_iso(0, 11, 30),
                make_iso(0, 12, 0),
                "scheduled",
                "Cutaneous rash flare-up on forearm and allergy sensitivity screening",
                "Patient allergic to penicillin. Dermatological topical review.",
                0
            ),
            (
                "apt-103",
                sample_patients[2][0],
                doc_anil,
                "LOCAL-APT-103",
                make_iso(0, 14, 0),
                make_iso(0, 14, 30),
                "completed",
                "Routine hypertension follow-up and ECG screening review",
                "BP recorded 128/82. Prescriptions renewed for 3 months.",
                0
            ),
            (
                "apt-104",
                sample_patients[3][0],
                doc_rahul,
                "LOCAL-APT-104",
                make_iso(1, 9, 30),
                make_iso(1, 10, 0),
                "confirmed",
                "Annual comprehensive executive health checkup and lipid panel discussion",
                "Fasting blood work scheduled beforehand.",
                0
            ),
            (
                "apt-105",
                sample_patients[4][0],
                doc_anil,
                "LOCAL-APT-105",
                make_iso(1, 15, 0),
                make_iso(1, 15, 30),
                "scheduled",
                "Mild palpitations post-exercise and cardiology consultation",
                "First-time cardiology patient at ABC Health Care.",
                0
            ),
            (
                "apt-106",
                sample_patients[5][0],
                doc_priya,
                "LOCAL-APT-106",
                make_iso(2, 11, 0),
                make_iso(2, 11, 30),
                "scheduled",
                "Acne treatment follow-up and clinical prescription evaluation",
                "Follow up on 4-week topical regimen.",
                0
            ),
            (
                "apt-107",
                sample_patients[0][0],
                doc_rahul,
                "LOCAL-APT-107",
                make_iso(-1, 16, 0),
                make_iso(-1, 16, 30),
                "completed",
                "Initial consultation for seasonal allergies and cold",
                "Patient reported immediate improvement with antihistamines.",
                0
            ),
        ]

        for aid, cid, did, cal_id, start, end, status, reason, notes, synced in sample_appts:
            cur.execute("""
                INSERT OR IGNORE INTO appointments 
                (id, customer_id, doctor_id, calendar_event_id, start_time, end_time, status, reason, notes, google_synced)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (aid, cid, did, cal_id, start, end, status, reason, notes, synced))

    def _prepare_sql_and_args(self, sql: str, args: Sequence[Any]) -> tuple:
        """Translate Postgres $1, $2 parameter placeholders and ILIKE to SQLite compatible SQL,
        expanding repeated placeholders properly."""
        placeholders = re.findall(r'\$(\d+)', sql)
        converted = re.sub(r'\$\d+', '?', sql)
        converted = re.sub(r'\bILIKE\b', 'LIKE', converted, flags=re.IGNORECASE)
        converted = re.sub(r'\bNOW\(\)', "datetime('now')", converted, flags=re.IGNORECASE)
        converted = re.sub(r'::\w+', '', converted)

        if placeholders:
            mapped_args = []
            for p in placeholders:
                idx = int(p) - 1
                if 0 <= idx < len(args):
                    val = args[idx]
                    if isinstance(val, uuid.UUID):
                        mapped_args.append(str(val))
                    elif isinstance(val, datetime):
                        mapped_args.append(val.isoformat())
                    else:
                        mapped_args.append(val)
                else:
                    mapped_args.append(None)
            return converted, mapped_args

        normalized_args = []
        for a in args:
            if isinstance(a, uuid.UUID):
                normalized_args.append(str(a))
            elif isinstance(a, datetime):
                normalized_args.append(a.isoformat())
            else:
                normalized_args.append(a)
        return converted, normalized_args

    def _run_fetch(self, query: str, *args) -> List[DictRow]:
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            clean_sql, bound_args = self._prepare_sql_and_args(query, args)
            cur.execute(clean_sql, bound_args)
            rows = cur.fetchall()
            conn.commit()
            return [DictRow(dict(r)) for r in rows]
        finally:
            conn.close()

    def _run_fetchrow(self, query: str, *args) -> Optional[DictRow]:
        rows = self._run_fetch(query, *args)
        return rows[0] if rows else None

    def _run_execute(self, query: str, *args) -> str:
        conn = self._get_connection()
        try:
            cur = conn.cursor()
            clean_sql, bound_args = self._prepare_sql_and_args(query, args)
            cur.execute(clean_sql, bound_args)
            conn.commit()
            return f"EXEC {cur.rowcount}"
        finally:
            conn.close()

    async def fetch(self, query: str, *args) -> List[DictRow]:
        return await asyncio.to_thread(self._run_fetch, query, *args)

    async def fetchrow(self, query: str, *args) -> Optional[DictRow]:
        return await asyncio.to_thread(self._run_fetchrow, query, *args)

    async def execute(self, query: str, *args) -> str:
        return await asyncio.to_thread(self._run_execute, query, *args)


# Global state
_pg_pool = None
_sqlite_adapter: Optional[SQLiteAdapter] = None
_active_backend = "sqlite"  # 'pg' or 'sqlite'


async def _ensure_postgres_schema(pool):
    """Ensure all required tables, columns, and seed data exist in PostgreSQL."""
    async with pool.acquire() as conn:
        try:
            await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        except Exception as e:
            logger.warning(f"Could not enable pgvector extension: {e}")

        await conn.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                phone TEXT NOT NULL UNIQUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS customer_memories (
                id BIGSERIAL PRIMARY KEY,
                customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                memory TEXT NOT NULL,
                embedding vector(1536),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS doctors (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                specialization TEXT NOT NULL,
                degrees TEXT,
                room TEXT,
                experience TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS appointments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
                doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
                calendar_event_id TEXT UNIQUE,
                start_time TIMESTAMPTZ NOT NULL,
                end_time TIMESTAMPTZ NOT NULL,
                status TEXT NOT NULL DEFAULT 'scheduled',
                reason TEXT,
                notes TEXT DEFAULT '',
                google_synced INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                CHECK (end_time > start_time)
            );

            ALTER TABLE doctors ADD COLUMN IF NOT EXISTS degrees TEXT;
            ALTER TABLE doctors ADD COLUMN IF NOT EXISTS room TEXT;
            ALTER TABLE doctors ADD COLUMN IF NOT EXISTS experience TEXT;

            ALTER TABLE appointments ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
            ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_synced INTEGER DEFAULT 0;
        """)

        for doc in SEED_DOCTORS:
            try:
                await conn.execute("""
                    INSERT INTO doctors (id, name, specialization, degrees, room, experience)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    ON CONFLICT (id) DO UPDATE
                    SET degrees = COALESCE(doctors.degrees, EXCLUDED.degrees),
                        room = COALESCE(doctors.room, EXCLUDED.room),
                        experience = COALESCE(doctors.experience, EXCLUDED.experience);
                """, uuid.UUID(doc["id"]), doc["name"], doc["specialization"], doc["degrees"], doc["room"], doc["experience"])
            except Exception as e:
                logger.warning(f"Failed to seed/update doctor {doc['name']}: {e}")


async def init_db():
    """Initialize database connection, prioritizing PostgreSQL with transparent SQLite fallback."""
    global _pg_pool, _sqlite_adapter, _active_backend

    # Always initialize SQLite adapter ready for local storage
    if _sqlite_adapter is None:
        _sqlite_adapter = SQLiteAdapter(SQLITE_DB_PATH)

    # Attempt PostgreSQL connection
    try:
        import asyncpg
        target_db_url = os.getenv("DATABASE_URL", DATABASE_URL)
        if target_db_url.startswith("postgres://"):
            target_db_url = target_db_url.replace("postgres://", "postgresql://", 1)
        pool = await asyncpg.create_pool(
            target_db_url,
            min_size=1,
            max_size=5,
            command_timeout=3.0,
        )
        # Test connection & ensure schema
        await _ensure_postgres_schema(pool)
        _pg_pool = pool
        _active_backend = "pg"
        logger.info("Connected to PostgreSQL database for ABC Health Care.")
        return _pg_pool
    except Exception as e:
        logger.warning(
            f"PostgreSQL connection failed ({e}). Seamlessly using local high-performance SQLite database: {SQLITE_DB_PATH}"
        )
        _pg_pool = None
        _active_backend = "sqlite"
        return _sqlite_adapter


async def close_db(reason: str = ""):
    """Close active database connections cleanly."""
    global _pg_pool
    if _pg_pool is not None:
        try:
            await _pg_pool.close()
        except Exception:
            pass
        finally:
            _pg_pool = None


async def get_pool():
    """Get active database interface (PostgreSQL pool or SQLite adapter)."""
    global _pg_pool, _sqlite_adapter, _active_backend
    if _active_backend == "pg" and _pg_pool is not None:
        return _pg_pool
    if _sqlite_adapter is None:
        await init_db()
    return _sqlite_adapter if _active_backend == "sqlite" else _pg_pool


def get_sqlite_adapter() -> SQLiteAdapter:
    """Synchronous accessor for local SQLite adapter."""
    global _sqlite_adapter
    if _sqlite_adapter is None:
        _sqlite_adapter = SQLiteAdapter(SQLITE_DB_PATH)
    return _sqlite_adapter