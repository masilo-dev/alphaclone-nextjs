"""Anti-bot evasion helpers."""

from __future__ import annotations

import random
import asyncio
from typing import Any

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15",
]

STEALTH_INIT_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', { get: () => false });
Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
window.chrome = { runtime: {} };
"""


class AntiBot:
    def get_random_user_agent(self) -> str:
        return random.choice(USER_AGENTS)

    def get_headers(self) -> dict[str, str]:
        return {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "User-Agent": self.get_random_user_agent(),
            "Referer": "https://www.google.com/",
        }

    async def random_delay(self, min_sec: float = 1.0, max_sec: float = 10.0) -> None:
        await asyncio.sleep(random.uniform(min_sec, max_sec))


class ProxyRotator:
    def __init__(self, proxy_list: list[str] | None = None) -> None:
        self.proxies = proxy_list or []
        self._index = 0

    def get_random(self) -> dict[str, Any] | None:
        if not self.proxies:
            return None
        proxy = random.choice(self.proxies)
        return {"server": proxy}

    def rotate(self) -> str | None:
        if not self.proxies:
            return None
        proxy = self.proxies[self._index % len(self.proxies)]
        self._index += 1
        return proxy
