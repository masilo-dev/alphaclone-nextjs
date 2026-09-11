"""User-defined custom URL sources."""

from __future__ import annotations

from typing import Any

from workers.scraper import PlaywrightScraper


class CustomScraper(PlaywrightScraper):
    async def scrape(self, config: dict[str, Any]) -> list[dict[str, Any]]:
        leads: list[dict[str, Any]] = []
        urls = config.get("custom_urls") or config.get("urls") or []
        selectors = config.get("selectors") or {"text": "body"}

        for url in urls[:config.get("daily_limit", 50)]:
            data = await self.scrape_with_js_rendering(url, selectors)
            if data:
                leads.append({
                    "source": "custom",
                    "raw_text": str(data),
                    "company_website": url,
                })
        return leads
