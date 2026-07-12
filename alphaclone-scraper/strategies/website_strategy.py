"""Company website scraping strategy."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse, parse_qs, unquote

from bs4 import BeautifulSoup
import aiohttp

from workers.scraper import PlaywrightScraper

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_RE = re.compile(r"(?:\+?\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?){2,}\d{3,4}")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


class WebsiteScraper(PlaywrightScraper):
    CONTACT_PATHS = ["/contact", "/team", "/about", "/about-us", "/people"]

    async def scrape(self, config: dict[str, Any]) -> list[dict[str, Any]]:
        leads: list[dict[str, Any]] = []
        companies = config.get("companies") or config.get("domains") or []

        if not companies and config.get("industry"):
            companies = await self._discover_domains(config)

        for domain in companies[: config.get("daily_limit", 50)]:
            domain = domain.replace("https://", "").replace("http://", "").split("/")[0]
            for path in self.CONTACT_PATHS:
                url = f"https://{domain}{path}"
                # Try lightweight aiohttp first; fall back to Playwright for JS-heavy pages
                data = await self._scrape_with_aiohttp(url)
                if not data:
                    data = await self.scrape_with_js_rendering(url, {
                        "text": "body",
                        "emails": 'a[href^="mailto:"]',
                        "phones": 'a[href^="tel:"]',
                    })
                if data:
                    leads.extend(self._parse_website_data(data, domain))

        return leads

    async def _scrape_with_aiohttp(self, url: str) -> dict[str, list[str]] | None:
        """Fast HTTP scrape without JavaScript rendering."""
        try:
            async with aiohttp.ClientSession(headers=HEADERS) as session:
                async with session.get(
                    url,
                    timeout=aiohttp.ClientTimeout(total=10),
                    allow_redirects=True,
                    ssl=False,
                ) as resp:
                    if resp.status != 200:
                        return None
                    html = await resp.text(errors="replace")
                    soup = BeautifulSoup(html, "html.parser")
                    text = soup.get_text(" ")
                    mailto_links = [
                        a["href"] for a in soup.find_all("a", href=True)
                        if a["href"].startswith("mailto:")
                    ]
                    tel_links = [
                        a["href"] for a in soup.find_all("a", href=True)
                        if a["href"].startswith("tel:")
                    ]
                    return {"text": [text], "emails": mailto_links, "phones": tel_links}
        except Exception:
            return None

    async def _discover_domains(self, config: dict[str, Any]) -> list[str]:
        keywords = config.get("industry", ["business"])
        location = config.get("location", {})
        city = location.get("city", "") if isinstance(location, dict) else str(location)
        kw = keywords[0] if isinstance(keywords, list) else keywords
        query = f"{kw} {city} company website"

        # Use DuckDuckGo HTML endpoint (no JS needed)
        ddg_url = f"https://html.duckduckgo.com/html/?q={query.replace(' ', '+')}"
        try:
            async with aiohttp.ClientSession(headers=HEADERS) as session:
                async with session.get(
                    ddg_url,
                    timeout=aiohttp.ClientTimeout(total=12),
                ) as resp:
                    if resp.status != 200:
                        return []
                    html = await resp.text(errors="replace")
                    soup = BeautifulSoup(html, "html.parser")

            domains: list[str] = []
            for a in soup.select("a.result__url, a.result__a"):
                href = a.get("href", "")
                # DDG wraps destination in ?uddg= query param
                try:
                    parsed = urlparse(href)
                    uddg = parse_qs(parsed.query).get("uddg", [""])[0]
                    target = unquote(uddg) if uddg else href
                    domain = urlparse(target).netloc or target.split("/")[0]
                    if domain and "." in domain and "duckduckgo" not in domain:
                        domains.append(domain)
                except Exception:
                    pass

            return list(dict.fromkeys(domains))[:20]  # deduplicate
        except Exception:
            return []

    def _parse_website_data(self, data: dict[str, list[str]], domain: str) -> list[dict[str, Any]]:
        leads = []
        text = " ".join(data.get("text", []))

        # Collect emails from page body + mailto links
        emails: set[str] = set(EMAIL_RE.findall(text))
        for mailto in data.get("emails", []):
            m = re.search(r"mailto:([^?]+)", mailto)
            if m:
                emails.add(m.group(1).strip())

        # Collect phones from body text + tel links
        phones: list[str] = PHONE_RE.findall(text)
        for tel in data.get("phones", []):
            m = re.search(r"tel:([^?]+)", tel)
            if m:
                phones.append(m.group(1).strip())

        for email in emails:
            if any(x in email.lower() for x in ["example.com", "sentry", "noreply", "no-reply"]):
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
