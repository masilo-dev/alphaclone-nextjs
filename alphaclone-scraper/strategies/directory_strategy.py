"""OpenStreetMap / Overpass API business discovery (Railway-hardened).

Changes vs original:
- Dual Overpass mirror with automatic failover on 429 / timeout
- Extracts email, address, opening_hours, and lat/lon from OSM tags
- Normalises location filter so city-level AND country-level both work
- Returns up to `daily_limit` leads (default 50)
"""

from __future__ import annotations

import asyncio
from typing import Any

import aiohttp

from utils.logging import log

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


async def _post_overpass(query: str, timeout: int = 30) -> dict | None:
    """POST to Overpass mirrors in order; return parsed JSON or None."""
    for endpoint in OVERPASS_ENDPOINTS:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    endpoint,
                    data={"data": query},
                    timeout=aiohttp.ClientTimeout(total=timeout),
                ) as resp:
                    if resp.status == 429:
                        log.warning(f"Overpass 429 on {endpoint}, trying next mirror")
                        continue
                    if resp.status != 200:
                        log.warning(f"Overpass {resp.status} on {endpoint}")
                        continue
                    return await resp.json(content_type=None)
        except asyncio.TimeoutError:
            log.warning(f"Overpass timeout on {endpoint}")
        except Exception as e:
            log.warning(f"Overpass error on {endpoint}: {e}")
    return None


class DirectoryScraper:
    async def scrape(self, config: dict[str, Any]) -> list[dict[str, Any]]:
        location = config.get("location", {})
        if isinstance(location, str):
            location = {"city": location}

        city = location.get("city", "")
        country = location.get("country", "")
        industry = config.get("industry", ["shop"])
        tag = industry[0] if isinstance(industry, list) else industry
        limit = config.get("daily_limit", 50)

        # ── Build Overpass query ─────────────────────────────────────────────
        # Use area filter when a city name is available; otherwise use country
        # or a global (unconstrained) query.
        if city:
            area_filter = f'area["name"="{city}"]->.searchArea;'
            area_clause = "(area.searchArea)"
        elif country:
            area_filter = f'area["name"="{country}"]->.searchArea;'
            area_clause = "(area.searchArea)"
        else:
            area_filter = ""
            area_clause = ""

        fetch_limit = min(limit * 3, 200)  # over-fetch, then trim

        query = f"""
[out:json][timeout:25];
{area_filter}
(
  node["name"]["{tag}"]{area_clause};
  way["name"]["{tag}"]{area_clause};
  node["amenity"~"{tag}",i]{area_clause};
  node["shop"~"{tag}",i]{area_clause};
  node["office"~"{tag}",i]{area_clause};
);
out center {fetch_limit};
        """.strip()

        data = await _post_overpass(query)
        if not data:
            return []

        leads: list[dict[str, Any]] = []
        for element in data.get("elements", []):
            tags = element.get("tags", {})
            name = tags.get("name")
            if not name:
                continue

            # Coordinates — nodes have lat/lon directly; ways expose center
            lat = element.get("lat") or (element.get("center") or {}).get("lat")
            lon = element.get("lon") or (element.get("center") or {}).get("lon")

            address_parts = [
                tags.get("addr:housenumber"),
                tags.get("addr:street"),
                tags.get("addr:city") or city,
                tags.get("addr:country") or country,
            ]
            address = ", ".join(p for p in address_parts if p)

            leads.append({
                "name": name,
                "company": name,
                "phone": (
                    tags.get("phone")
                    or tags.get("contact:phone")
                    or tags.get("phone:mobile")
                ),
                "email": tags.get("email") or tags.get("contact:email"),
                "company_website": tags.get("website") or tags.get("contact:website"),
                "location": address or f"{city}, {country}".strip(", "),
                "industry": tags.get("amenity") or tags.get("shop") or tags.get("office") or tag,
                "opening_hours": tags.get("opening_hours"),
                "lat": lat,
                "lon": lon,
                "source": "directory",
                "raw_text": str(tags),
            })

        return leads[:limit]
