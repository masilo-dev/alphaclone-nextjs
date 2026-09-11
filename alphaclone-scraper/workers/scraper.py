"""Base Playwright scraper with anti-bot evasion."""

from __future__ import annotations

import asyncio
from typing import Any

from playwright.async_api import Browser, Page, async_playwright

from evasion.anti_bot import STEALTH_INIT_SCRIPT, AntiBot, ProxyRotator
from evasion.request_throttler import RequestThrottler
from utils.config import get_settings
from utils.logging import log


class PlaywrightScraper:
    def __init__(self) -> None:
        s = get_settings()
        self.anti_bot = AntiBot()
        self.proxy_rotator = ProxyRotator(s.proxies)
        self.throttler = RequestThrottler()
        self._browser: Browser | None = None
        self._playwright = None

    async def init_browser(self) -> None:
        if self._browser:
            return
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-gpu",
            ],
        )

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None

    async def create_context(self):
        await self.init_browser()
        proxy = self.proxy_rotator.get_random()
        kwargs: dict[str, Any] = {
            "user_agent": self.anti_bot.get_random_user_agent(),
            "viewport": {"width": 1920, "height": 1080},
            "locale": "en-US",
            "timezone_id": "America/New_York",
        }
        if proxy:
            kwargs["proxy"] = proxy
        return await self._browser.new_context(**kwargs)

    async def scrape_with_js_rendering(
        self, url: str, selectors: dict[str, str]
    ) -> dict[str, list[str]] | None:
        from urllib.parse import urlparse

        domain = urlparse(url).netloc
        await self.throttler.wait(domain)

        context = await self.create_context()
        page: Page = await context.new_page()
        await page.add_init_script(STEALTH_INIT_SCRIPT)

        try:
            await page.goto(url, wait_until="networkidle", timeout=30000)
            data: dict[str, list[str]] = {}
            for key, selector in selectors.items():
                try:
                    elements = await page.locator(selector).all_inner_texts()
                    data[key] = [e.strip() for e in elements if e.strip()]
                except Exception:
                    data[key] = []
            return data
        except Exception as e:
            log.warning(f"Error scraping {url}: {e}")
            return None
        finally:
            await context.close()
