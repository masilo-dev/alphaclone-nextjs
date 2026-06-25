"""Company website scraping strategy."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

from bs4 import BeautifulSoup
import aiohttp

from workers.scraper import PlaywrightScraper

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")


class WebsiteScraper(PlaywrightScraper):
    CONTACT_PATHS = ["/contact", "/team", "/about", "/about-us", "/people"]

    async def scrape(self, config: dict[str, Any]) -> list[dict[str, Any]]:
        leads: list[dict[str, Any]] = []
        companies = config.get("companies") or config.get("domains") or []

        if not companies and config.get("industry"):
            companies = await self._discover_domains(config)

        for domain in companies[:config.get("daily_limit", 50)]:
            domain = domain.replace("https://", "").replace("http://", "").split("/")[0]
            for path in self.CONTACT_PATHS:
                url = f"https://{domain}{path}"
                data = await self.scrape_with_js_rendering(url, {
                    "text": "body",
                    "emails": 'a[href^="mailto:"]',
                    "phones": 'a[href^="tel:"]',
                })
                if data:
                    leads.extend(self._parse_website_data(data, domain))
        return leads

    async def _discover_domains(self, config: dict[str, Any]) -> list[str]:
        keywords = config.get("industry", ["business"])
        location = config.get("location", {})
        city = location.get("city", "") if isinstance(location, dict) else str(location)
        query = f"{keywords[0] if isinstance(keywords, list) else keywords} {city} company website"
        data = await self.scrape_with_js_rendering(
            f"https://duckduckgo.com/?q={query.replace(' ', '+')}",
            {"links": "a.result__a"},
        )
        domains = []
        if data:
            for link in data.get("links", [])[:20]:
                if "." in link:
                    domains.append(link)
        return domains

    def _parse_website_data(self, data: dict[str, list[str]], domain: str) -> list[dict[str, Any]]:
        leads = []
        text = " ".join(data.get("text", []))
        emails = set(EMAIL_RE.findall(text))
        for mailto in data.get("emails", []):
            m = re.search(r"mailto:([^?]+)", mailto)
            if m:
                emails.add(m.group(1))

        phones = []
        for tel in data.get("phones", []):
            m = re.search(r"tel:([^?]+)", tel)
            if m:
                phones.append(m.group(1))

        for email in emails:
            if "example.com" in email or "sentry" in email:
                continue
            leads.append({
                "email": email,
                "phone": phones[0] if phones else None,
                "company": domain,
                "company_website": f"https://{domain}",
                "source": "website",
                "raw_text": text[:2000],
            })
        return leads
