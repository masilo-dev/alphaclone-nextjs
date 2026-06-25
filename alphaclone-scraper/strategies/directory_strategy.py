"""OpenStreetMap / Overpass API business discovery."""

from __future__ import annotations

from typing import Any

import aiohttp

from utils.logging import log

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


class DirectoryScraper:
    async def scrape(self, config: dict[str, Any]) -> list[dict[str, Any]]:
        location = config.get("location", {})
        if isinstance(location, str):
            location = {"city": location}

        city = location.get("city", "")
        country = location.get("country", "")
        industry = config.get("industry", ["shop"])
        tag = industry[0] if isinstance(industry, list) else industry

        area_filter = ""
        if city:
            area_filter = f'area["name"="{city}"]->.searchArea;'
            area_clause = "(area.searchArea)"
        else:
            area_clause = ""

        query = f"""
        [out:json][timeout:25];
        {area_filter}
        (
          node["name"]["{tag}"]({area_clause});
          way["name"]["{tag}"]({area_clause});
        );
        out body 50;
        """

        leads: list[dict[str, Any]] = []
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(OVERPASS_URL, data={"data": query}, timeout=30) as resp:
                    if resp.status != 200:
                        return leads
                    data = await resp.json()

            for element in data.get("elements", []):
                tags = element.get("tags", {})
                name = tags.get("name")
                if not name:
                    continue
                leads.append({
                    "name": name,
                    "company": name,
                    "phone": tags.get("phone") or tags.get("contact:phone"),
                    "company_website": tags.get("website") or tags.get("contact:website"),
                    "location": f"{city}, {country}".strip(", "),
                    "industry": tag,
                    "source": "directory",
                    "raw_text": str(tags),
                })
        except Exception as e:
            log.warning(f"Overpass query failed: {e}")

        return leads[: config.get("daily_limit", 50)]
