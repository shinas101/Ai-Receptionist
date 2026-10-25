CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================
-- CUSTOMERS
-- ============================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL,

    phone TEXT NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- CUSTOMER MEMORIES
-- ============================================

CREATE TABLE customer_memories (
    id BIGSERIAL PRIMARY KEY,

    customer_id UUID NOT NULL
        REFERENCES customers(id)
        ON DELETE CASCADE,

    memory TEXT NOT NULL,

    embedding vector(1536),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_memories_customer
ON customer_memories(customer_id);


-- ============================================
-- APPOINTMENTS
-- ============================================

CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    specialization TEXT NOT NULL,
    degrees TEXT,
    room TEXT,
    experience TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    customer_id UUID NOT NULL
        REFERENCES customers(id)
        ON DELETE CASCADE,

    doctor_id UUID NOT NULL
        REFERENCES doctors(id)
        ON DELETE RESTRICT,

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

CREATE INDEX idx_appointments_customer
ON appointments(customer_id);

CREATE INDEX idx_appointments_doctor
ON appointments(doctor_id);

CREATE INDEX idx_appointments_start_time
ON appointments(start_time);

CREATE INDEX idx_customer_memories_embedding
ON customer_memories
USING hnsw (embedding vector_cosine_ops);