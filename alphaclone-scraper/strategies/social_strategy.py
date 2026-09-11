"""Twitter/X and social profile scraping."""

from __future__ import annotations

from typing import Any

from workers.scraper import PlaywrightScraper


class SocialScraper(PlaywrightScraper):
    async def scrape(self, config: dict[str, Any]) -> list[dict[str, Any]]:
        leads: list[dict[str, Any]] = []
        keywords = config.get("title_keywords") or config.get("industry") or ["saas"]

        for kw in (keywords if isinstance(keywords, list) else [keywords])[:3]:
            url = f"https://nitter.net/search?f=users&q={kw}"
            data = await self.scrape_with_js_rendering(url, {
                "users": ".username",
                "bios": ".tweet-content",
            })
            if not data:
                continue
            for i, user in enumerate(data.get("users", [])):
                leads.append({
                    "name": user.replace("@", ""),
                    "twitter_url": f"https://twitter.com/{user.replace('@', '')}",
                    "bio": data.get("bios", [])[i] if i < len(data.get("bios", [])) else "",
                    "source": "twitter",
                    "raw_text": data.get("bios", [])[i] if i < len(data.get("bios", [])) else user,
                })
        return leads[: config.get("daily_limit", 30)]
