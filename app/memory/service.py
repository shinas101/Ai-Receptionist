import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from typing import Optional, List, Dict, Any, Sequence

from app.memory.db import get_pool
from app.memory.embeddings import create_embedding


def _clean_record(record: Any) -> Optional[Dict[str, Any]]:
    if record is None:
        return None
    d = dict(record)
    for k, v in list(d.items()):
        if isinstance(v, uuid.UUID):
            d[k] = str(v)
        elif isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


def _clean_records(records: Sequence[Any]) -> List[Dict[str, Any]]:
    return [_clean_record(r) for r in records if r is not None]


def _parse_iso(val: Any) -> datetime:
    tz = ZoneInfo("Asia/Kolkata")
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=tz)
        return val.astimezone(tz)
    try:
        dt = datetime.fromisoformat(str(val))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=tz)
        return dt.astimezone(tz)
    except Exception:
        return datetime.now(tz)


# ============================================
# CUSTOMERS
# ============================================

async def get_customer_by_phone(phone: str | int):
    pool = await get_pool()
    phone_str = str(phone).strip()

    row = await pool.fetchrow(
        """
        SELECT id, name, phone
        FROM customers
        WHERE phone = $1
        """,
        phone_str,
    )
    return _clean_record(row)


async def get_customer_by_id(customer_id: str | uuid.UUID):
    pool = await get_pool()
    cid = str(customer_id)
    row = await pool.fetchrow(
        """
        SELECT id, name, phone
        FROM customers
        WHERE id = $1
        """,
        cid,
    )
    return _clean_record(row)


async def create_customer(name: str, phone: str | int, **kwargs):
    pool = await get_pool()
    phone_str = str(phone).strip()
    cid = str(uuid.uuid4())

    existing = await get_customer_by_phone(phone_str)
    if existing:
        await pool.execute(
            """
            UPDATE customers
            SET name = $1, updated_at = NOW()
            WHERE id::text = $2
            """,
            name.strip(),
            str(existing["id"]),
        )
        return await get_customer_by_id(existing["id"])

    await pool.execute(
        """
        INSERT INTO customers (id, name, phone)
        VALUES ($1, $2, $3)
        """,
        cid,
        name.strip(),
        phone_str,
    )
    return await get_customer_by_id(cid)


# ============================================
# MEMORIES
# ============================================

async def save_memory(
    customer_id: str | uuid.UUID,
    memory: str,
):
    cid = str(customer_id)
    embedding = None
    try:
        embedding = await create_embedding(memory)
    except Exception:
        pass
    embedding_val = str(embedding) if embedding is not None else None

    pool = await get_pool()

    await pool.execute(
        """
        INSERT INTO customer_memories
        (
            customer_id,
            memory,
            embedding
        )
        VALUES ($1, $2, $3)
        """,
        cid,
        memory,
        embedding_val,
    )


async def get_memories(
    customer_id: str | uuid.UUID,
    limit: int = 10,
):
    cid = str(customer_id)
    pool = await get_pool()

    return await pool.fetch(
        """
        SELECT memory, created_at
        FROM customer_memories
        WHERE customer_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        cid,
        limit,
    )


async def search_memories(
    customer_id: str | uuid.UUID,
    query: str,
    limit: int = 5,
):
    cid = str(customer_id)
    pool = await get_pool()

    try:
        query_embedding = await create_embedding(query)
    except Exception:
        query_embedding = None

    if query_embedding is None:
        rows = await get_memories(cid, limit=limit)
        return [
            {"memory": r["memory"], "similarity": 1.0}
            for r in rows
        ]

    # For postgres with pgvector
    try:
        return await pool.fetch(
            """
            SELECT
                memory,
                1 - (embedding <=> $1::vector) AS similarity
            FROM customer_memories
            WHERE customer_id = $2 AND embedding IS NOT NULL
            ORDER BY embedding <=> $1::vector
            LIMIT $3
            """,
            str(query_embedding),
            cid,
            limit,
        )
    except Exception:
        rows = await get_memories(cid, limit=limit)
        return [{"memory": r["memory"], "similarity": 1.0} for r in rows]


# ============================================
# DOCTORS
# ============================================

async def get_doctors():
    """Retrieve all doctors registered at ABC Health Care."""
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id, name, specialization, degrees, room, experience
        FROM doctors
        ORDER BY name ASC
        """
    )
    return _clean_records(rows)


async def get_doctor_by_id(doctor_id: str | uuid.UUID):
    """Retrieve a doctor by their ID."""
    if not doctor_id:
        return None
    did = str(doctor_id).strip()
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        SELECT id, name, specialization, degrees, room, experience
        FROM doctors
        WHERE id = $1
        """,
        did,
    )
    return _clean_record(row)


async def find_doctor(query: str):
    """Find doctors matching name or specialization."""
    pool = await get_pool()
    q = f"%{query.strip()}%"
    rows = await pool.fetch(
        """
        SELECT id, name, specialization, degrees, room, experience
        FROM doctors
        WHERE name ILIKE $1 OR specialization ILIKE $1
        ORDER BY name ASC
        """,
        q,
    )
    return _clean_records(rows)


async def get_default_doctor():
    """Get default doctor (General Physician) or first available doctor."""
    pool = await get_pool()
    doc = await pool.fetchrow(
        """
        SELECT id, name, specialization, degrees, room, experience
        FROM doctors
        WHERE specialization ILIKE '%general%'
        LIMIT 1
        """
    )
    if not doc:
        doc = await pool.fetchrow(
            """
            SELECT id, name, specialization, degrees, room, experience
            FROM doctors
            ORDER BY name ASC
            LIMIT 1
            """
        )
    return _clean_record(doc)


# ============================================
# APPOINTMENTS
# ============================================

async def get_all_appointments(
    doctor_id: Optional[str] = None,
    status: Optional[str] = None,
    date_str: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Retrieve appointments with full joined patient and doctor details."""
    pool = await get_pool()

    conditions = ["1=1"]
    params = []

    if doctor_id and doctor_id.strip():
        conditions.append(f"a.doctor_id = ${len(params) + 1}")
        params.append(doctor_id.strip())

    if status and status.strip() and status != "all":
        conditions.append(f"a.status = ${len(params) + 1}")
        params.append(status.strip())

    if date_str and date_str.strip():
        # Filter for appointments matching the date substring e.g. '2026-10-23'
        conditions.append(f"a.start_time::text LIKE ${len(params) + 1}")
        params.append(f"{date_str.strip()}%")

    if search and search.strip():
        term = f"%{search.strip()}%"
        p_idx = len(params) + 1
        conditions.append(
            f"(c.name ILIKE ${p_idx} OR c.phone ILIKE ${p_idx} OR a.reason ILIKE ${p_idx} OR d.name ILIKE ${p_idx} OR a.calendar_event_id ILIKE ${p_idx})"
        )
        params.append(term)

    where_clause = " AND ".join(conditions)

    sql = f"""
        SELECT 
            a.id, 
            a.customer_id,
            a.doctor_id,
            a.calendar_event_id, 
            a.start_time, 
            a.end_time, 
            a.status,
            a.reason,
            a.notes,
            a.google_synced,
            a.created_at,
            a.updated_at,
            c.name AS patient_name,
            c.phone AS patient_phone,
            d.name AS doctor_name,
            d.specialization AS doctor_specialization,
            d.degrees AS doctor_degrees,
            d.room AS doctor_room
        FROM appointments a
        LEFT JOIN customers c ON a.customer_id = c.id
        LEFT JOIN doctors d ON a.doctor_id = d.id
        WHERE {where_clause}
        ORDER BY a.start_time ASC
    """

    rows = await pool.fetch(sql, *params)
    return _clean_records(rows)


async def get_appointment_by_id(appointment_id: str | uuid.UUID):
    pool = await get_pool()
    aid = str(appointment_id).strip()

    row = await pool.fetchrow(
        """
        SELECT 
            a.id, 
            a.customer_id,
            a.doctor_id,
            a.calendar_event_id, 
            a.start_time, 
            a.end_time, 
            a.status,
            a.reason,
            a.notes,
            a.google_synced,
            a.created_at,
            a.updated_at,
            c.name AS patient_name,
            c.phone AS patient_phone,
            d.name AS doctor_name,
            d.specialization AS doctor_specialization,
            d.degrees AS doctor_degrees,
            d.room AS doctor_room
        FROM appointments a
        LEFT JOIN customers c ON a.customer_id = c.id
        LEFT JOIN doctors d ON a.doctor_id = d.id
        WHERE a.id::text = $1 OR a.calendar_event_id = $1
        """,
        aid,
    )
    return _clean_record(row)


async def save_appointment(
    customer_id: str | uuid.UUID,
    calendar_event_id: Optional[str],
    start_time: datetime | str,
    end_time: datetime | str,
    reason: str = "",
    status: str = "scheduled",
    doctor_id: Optional[str | uuid.UUID] = None,
    notes: str = "",
    google_synced: int = 0,
):
    pool = await get_pool()
    aid = str(uuid.uuid4())
    cid = str(customer_id)

    doc_str = None
    if doctor_id:
        doc_str = str(doctor_id)
    if not doc_str:
        default_doc = await get_default_doctor()
        if default_doc:
            doc_str = str(default_doc["id"])

    start_dt = start_time if isinstance(start_time, datetime) else _parse_iso(start_time)
    end_dt = end_time if isinstance(end_time, datetime) else _parse_iso(end_time)

    cal_event_str = calendar_event_id or f"LOCAL-{aid.upper()}"

    await pool.execute(
        """
        INSERT INTO appointments
        (
            id,
            customer_id,
            doctor_id,
            calendar_event_id,
            start_time,
            end_time,
            reason,
            notes,
            status,
            google_synced
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        """,
        aid,
        cid,
        doc_str,
        cal_event_str,
        start_dt,
        end_dt,
        reason,
        notes,
        status,
        int(google_synced),
    )

    return await get_appointment_by_id(aid)


async def update_appointment_status(
    calendar_event_id_or_id: str,
    status: str,
):
    pool = await get_pool()
    eid = str(calendar_event_id_or_id).strip()

    await pool.execute(
        """
        UPDATE appointments
        SET status = $1, updated_at = NOW()
        WHERE calendar_event_id = $2 OR id::text = $2
        """,
        status,
        eid,
    )
    return await get_appointment_by_id(eid)


async def update_appointment_time(
    calendar_event_id_or_id: str,
    start_time: datetime | str,
    end_time: datetime | str,
):
    pool = await get_pool()
    eid = str(calendar_event_id_or_id).strip()
    start_dt = start_time if isinstance(start_time, datetime) else _parse_iso(start_time)
    end_dt = end_time if isinstance(end_time, datetime) else _parse_iso(end_time)

    await pool.execute(
        """
        UPDATE appointments
        SET start_time = $1, end_time = $2, updated_at = NOW()
        WHERE calendar_event_id = $3 OR id::text = $3
        """,
        start_dt,
        end_dt,
        eid,
    )
    return await get_appointment_by_id(eid)


async def update_appointment_full(
    appointment_id: str,
    status: Optional[str] = None,
    start_time: Optional[datetime | str] = None,
    end_time: Optional[datetime | str] = None,
    doctor_id: Optional[str] = None,
    reason: Optional[str] = None,
    notes: Optional[str] = None,
    google_synced: Optional[int] = None,
):
    """Full update for appointment record from Admin View."""
    pool = await get_pool()
    current = await get_appointment_by_id(appointment_id)
    if not current:
        return None

    new_status = status if status is not None else current["status"]
    new_start = _parse_iso(start_time) if start_time is not None else _parse_iso(current["start_time"])
    new_end = _parse_iso(end_time) if end_time is not None else _parse_iso(current["end_time"])
    new_doc = doctor_id or current["doctor_id"]
    new_reason = reason if reason is not None else current["reason"]
    new_notes = notes if notes is not None else current.get("notes", "")
    new_synced = google_synced if google_synced is not None else current.get("google_synced", 0)

    await pool.execute(
        """
        UPDATE appointments
        SET status = $1, start_time = $2, end_time = $3, doctor_id = $4, reason = $5, notes = $6, google_synced = $7, updated_at = NOW()
        WHERE id::text = $8 OR calendar_event_id = $8
        """,
        new_status,
        new_start,
        new_end,
        new_doc,
        new_reason,
        new_notes,
        new_synced,
        appointment_id,
    )
    return await get_appointment_by_id(appointment_id)


async def delete_appointment(appointment_id_or_event_id: str) -> bool:
    """Delete an appointment record from the database."""
    pool = await get_pool()
    aid = str(appointment_id_or_event_id).strip()
    await pool.execute(
        """
        DELETE FROM appointments
        WHERE id::text = $1 OR calendar_event_id = $1
        """,
        aid,
    )
    return True


async def get_customer_appointments(
    customer_id: str | uuid.UUID,
    limit: int = 5,
):
    cid = str(customer_id)
    pool = await get_pool()

    rows = await pool.fetch(
        """
        SELECT 
            a.id, 
            a.calendar_event_id, 
            a.start_time, 
            a.end_time, 
            a.reason, 
            a.status,
            a.doctor_id,
            d.name AS doctor_name,
            d.specialization AS doctor_specialization
        FROM appointments a
        LEFT JOIN doctors d ON a.doctor_id = d.id
        WHERE a.customer_id = $1
        ORDER BY a.start_time DESC
        LIMIT $2
        """,
        cid,
        limit,
    )
    return _clean_records(rows)


# ============================================
# LOCAL AVAILABILITY CHECKING (No Google required)
# ============================================


async def check_local_availability(
    start: datetime,
    end: datetime,
    doctor_id: Optional[str] = None,
    exclude_appointment_id: Optional[str] = None,
) -> bool:
    """Check if time slot [start, end] is available in local clinic records."""
    pool = await get_pool()

    # Query all active (not cancelled) appointments
    sql = """
        SELECT id, doctor_id, start_time, end_time, status
        FROM appointments
        WHERE status != 'cancelled'
    """
    params = []
    if doctor_id and doctor_id.strip():
        sql += " AND doctor_id = $1"
        params.append(doctor_id.strip())

    rows = await pool.fetch(sql, *params)

    for r in rows:
        if exclude_appointment_id and (r["id"] == exclude_appointment_id or r.get("calendar_event_id") == exclude_appointment_id):
            continue
        try:
            r_start = _parse_iso(r["start_time"])
            r_end = _parse_iso(r["end_time"])

            # Check overlap: (start < r_end) and (end > r_start)
            if start < r_end and end > r_start:
                return False
        except Exception:
            continue

    return True


async def get_local_available_slots(
    date_str: str,
    duration_minutes: int = 30,
    doctor_id: Optional[str] = None,
) -> List[Dict[str, str]]:
    """Generate available 30-min time slots for given date between 09:00 and 17:00 IST."""
    tz = ZoneInfo("Asia/Kolkata")
    try:
        day = datetime.fromisoformat(date_str)
    except Exception:
        day = datetime.now(tz)
    if day.tzinfo is None:
        day = day.replace(tzinfo=tz)

    opening = day.replace(hour=9, minute=0, second=0, microsecond=0)
    closing = day.replace(hour=17, minute=0, second=0, microsecond=0)

    slots = []
    current = opening

    while current + timedelta(minutes=duration_minutes) <= closing:
        end = current + timedelta(minutes=duration_minutes)
        is_free = await check_local_availability(current, end, doctor_id=doctor_id)
        if is_free:
            slots.append({
                "start": current.isoformat(),
                "end": end.isoformat(),
            })
        current += timedelta(minutes=30)

    return slots