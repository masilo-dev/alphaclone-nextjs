"""Supabase database client."""

from __future__ import annotations

from functools import lru_cache

from supabase import create_client, Client

from utils.config import get_settings


@lru_cache
def get_supabase() -> Client | None:
    s = get_settings()
    if not s.supabase_url or not s.supabase_key:
        return None
    return create_client(s.supabase_url, s.supabase_key)
