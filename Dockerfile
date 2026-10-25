# ==============================================================================
# Production Dockerfile for LiveKit AI Voice Agent
# Optimized with Astral uv, byte-compilation, and pre-cached Silero VAD weights
# ==============================================================================

FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Set working directory
WORKDIR /app

# Configure Python and uv for high performance in container
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Install essential system dependencies (for audio, SSL, and network tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency specifications first for Docker layer caching
COPY pyproject.toml uv.lock ./

# Install Python packages into isolated virtual environment
RUN uv sync --frozen --no-install-project --no-dev

# Copy application source code
COPY . .

# Pre-download and cache Silero VAD model weights in the image layer
# This prevents network fetch delays during live call startup
RUN uv run python -c "from livekit.plugins import silero; silero.VAD.load()"

# Run agent in production daemon mode (agent.py start)
CMD ["uv", "run", "agent.py", "start"]
