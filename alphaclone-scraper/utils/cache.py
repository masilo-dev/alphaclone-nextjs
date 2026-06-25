"""Optional Redis cache via Upstash REST API."""

from __future__ import annotations

import json
from typing import Any

import httpx

from utils.config import get_settings


class Cache:
    def __init__(self) -> None:
        s = get_settings()
        self.url = s.upstash_redis_rest_url.rstrip("/") if s.upstash_redis_rest_url else ""
        self.token = s.upstash_redis_rest_token
        self.enabled = bool(self.url and self.token)

    async def get(self, key: str) -> Any | None:
        if not self.enabled:
            return None
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.url}/get/{key}",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10,
            )
            if r.status_code != 200:
                return None
            data = r.json()
            result = data.get("result")
            if result is None:
                return None
            try:
                return json.loads(result)
            except (json.JSONDecodeError, TypeError):
                return result

    async def set(self, key: str, value: Any, ttl_seconds: int = 3600) -> None:
        if not self.enabled:
            return
        payload = json.dumps(value)
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{self.url}/set/{key}/{payload}",
                params={"EX": ttl_seconds},
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10,
            )


cache = Cache()
