# ── Stage 1: Python + Playwright pre-installed ──────────────────────────────
# The Microsoft Playwright image bundles Chromium + system deps.
# Pinned to match playwright==1.40.0 in requirements.txt.
FROM mcr.microsoft.com/playwright/python:v1.40.0-jammy

WORKDIR /app

# ── System deps for Railway bare-metal build ─────────────────────────────────
# curl is needed for the healthcheck; libglib2.0-0 et al. for Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ───────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── SpaCy language models (CPU only, en + common EU languages) ────────────────
RUN python -m spacy download en_core_web_sm \
    && python -m spacy download fr_core_news_sm \
    && python -m spacy download es_core_news_sm \
    && python -m spacy download de_core_news_sm

# ── Ensure Playwright browsers are installed inside THIS image ────────────────
# Required on Railway because the mounted filesystem is ephemeral —
# browsers installed in a base image layer are already present here,
# but this explicit step ensures the correct channel + deps.
RUN playwright install chromium --with-deps

# ── Application code ──────────────────────────────────────────────────────────
COPY . .

# ── Runtime ───────────────────────────────────────────────────────────────────
ENV PORT=8000
EXPOSE 8000

# 60 s start-up grace period lets SpaCy + Playwright warm up
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
