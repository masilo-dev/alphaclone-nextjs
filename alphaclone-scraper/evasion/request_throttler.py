"""Request throttling for respectful scraping."""

from __future__ import annotations

import asyncio
import time
from collections import defaultdict

from utils.config import get_settings


class RequestThrottler:
    def __init__(self) -> None:
        s = get_settings()
        self.min_delay = s.scrape_delay_min
        self.max_delay = s.scrape_delay_max
        self._last_request: dict[str, float] = defaultdict(float)

    async def wait(self, domain: str) -> None:
        import random

        now = time.monotonic()
        elapsed = now - self._last_request[domain]
        delay = random.uniform(self.min_delay, self.max_delay)
        if elapsed < delay:
            await asyncio.sleep(delay - elapsed)
        self._last_request[domain] = time.monotonic()
