"""Job board scraping."""

from __future__ import annotations

from typing import Any

from workers.scraper import PlaywrightScraper


class JobBoardScraper(PlaywrightScraper):
    async def scrape(self, config: dict[str, Any]) -> list[dict[str, Any]]:
        leads: list[dict[str, Any]] = []
        job_urls = config.get("job_urls", [])
        keywords = config.get("title_keywords") or ["hiring"]

        if not job_urls:
            loc = config.get("location", {})
            city = loc.get("city", "") if isinstance(loc, dict) else str(loc)
            query = f"{keywords[0] if keywords else 'manager'} {city}".strip()
            job_urls = [
                f"https://www.indeed.com/jobs?q={query.replace(' ', '+')}",
            ]

        for url in job_urls[:5]:
            data = await self.scrape_with_js_rendering(url, {
                "companies": ".companyName",
                "titles": ".jobTitle",
            })
            if not data:
                continue
            companies = data.get("companies", [])
            titles = data.get("titles", [])
            for i, company in enumerate(companies):
                leads.append({
                    "company": company,
                    "title": titles[i] if i < len(titles) else None,
                    "source": "job_board",
                    "raw_text": f"{company} {titles[i] if i < len(titles) else ''}",
                })
        return leads[: config.get("daily_limit", 50)]
