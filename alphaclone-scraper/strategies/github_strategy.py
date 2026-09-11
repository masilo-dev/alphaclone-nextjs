"""GitHub developer discovery."""

from __future__ import annotations

from typing import Any

from workers.scraper import PlaywrightScraper


class GitHubScraper(PlaywrightScraper):
    async def scrape(self, config: dict[str, Any]) -> list[dict[str, Any]]:
        leads: list[dict[str, Any]] = []
        keywords = config.get("tech_keywords") or config.get("title_keywords") or ["python"]

        for keyword in keywords[:5]:
            url = f"https://github.com/search?q=language:{keyword}&type=users"
            data = await self.scrape_with_js_rendering(url, {
                "users": ".user-list-item .mr-1",
                "bios": ".user-list-bio",
            })
            if not data:
                continue
            users = data.get("users", [])
            bios = data.get("bios", [])
            for i, user in enumerate(users):
                leads.append({
                    "name": user,
                    "github_url": f"https://github.com/{user.replace('@', '').strip()}",
                    "bio": bios[i] if i < len(bios) else "",
                    "source": "github",
                    "raw_text": bios[i] if i < len(bios) else user,
                })
        return leads[: config.get("daily_limit", 50)]
