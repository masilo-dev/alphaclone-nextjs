"""LinkedIn public search scraping (conservative rate limits)."""

from __future__ import annotations

import re
from typing import Any

from workers.scraper import PlaywrightScraper


class LinkedInScraper(PlaywrightScraper):
    async def scrape(self, config: dict[str, Any]) -> list[dict[str, Any]]:
        leads: list[dict[str, Any]] = []
        keywords = config.get("title_keywords") or ["CEO"]
        location = config.get("location", {})
        loc_str = location.get("city", "") if isinstance(location, dict) else str(location)

        for kw in keywords[:3]:
            query = f"{kw} {loc_str}".strip()
            url = f"https://www.linkedin.com/search/results/people/?keywords={query.replace(' ', '%20')}"
            data = await self.scrape_with_js_rendering(url, {
                "profiles": ".entity-result__title-text a",
                "subtitles": ".entity-result__primary-subtitle",
            })
            if not data:
                continue
            profiles = data.get("profiles", [])
            subtitles = data.get("subtitles", [])
            for i, profile in enumerate(profiles):
                leads.append({
                    "name": profile,
                    "title": subtitles[i] if i < len(subtitles) else None,
                    "linkedin_url": profile if profile.startswith("http") else None,
                    "source": "linkedin",
                    "raw_text": f"{profile} {subtitles[i] if i < len(subtitles) else ''}",
                })
        return leads[: config.get("daily_limit", 20)]
