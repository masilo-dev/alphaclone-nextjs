"""Lead enrichment: email, phone, company data."""

from __future__ import annotations

import re
from typing import Any

import aiohttp
import dns.resolver
from email_validator import validate_email, EmailNotValidError

from utils.config import get_settings
from utils.logging import log


class EnricherWorker:
    def __init__(self) -> None:
        s = get_settings()
        self.apollo_key = s.apollo_api_key
        self.hunter_key = s.hunter_api_key

    async def enrich_batch(
        self, leads: list[dict[str, Any]], enrichment_level: str = "full"
    ) -> list[dict[str, Any]]:
        import asyncio
        tasks = [self.enrich_single(lead, enrichment_level) for lead in leads]
        return await asyncio.gather(*tasks)

    async def enrich_single(self, lead: dict[str, Any], level: str) -> dict[str, Any]:
        enriched = dict(lead)

        if not enriched.get("email"):
            enriched["email"] = await self.find_email(
                enriched.get("name"),
                enriched.get("company"),
                enriched.get("company_website"),
            )

        if not enriched.get("phone") and enriched.get("company"):
            enriched["phone"] = await self.find_phone(enriched.get("company"))

        if level == "full":
            if enriched.get("company_website"):
                enriched["company_data"] = await self.fetch_company_data(
                    enriched["company_website"]
                )
            enriched["email_valid"] = await self.validate_email_dns(enriched.get("email"))
            enriched["phone_valid"] = self.validate_phone(enriched.get("phone"))

        return enriched

    async def find_email(
        self, name: str | None, company: str | None, website: str | None
    ) -> str | None:
        if self.apollo_key and name and company:
            email = await self._apollo_find_email(name, company)
            if email:
                return email

        domain = self._extract_domain(website or company)
        if self.hunter_key and domain:
            email = await self._hunter_find_email(domain)
            if email:
                return email

        if name and domain:
            return await self.generate_email_patterns(name, domain)

        return None

    async def _apollo_find_email(self, name: str, company: str) -> str | None:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://api.apollo.io/v1/people/match",
                    headers={"Content-Type": "application/json", "X-Api-Key": self.apollo_key},
                    json={"name": name, "organization_name": company},
                    timeout=15,
                ) as resp:
                    if resp.status != 200:
                        return None
                    data = await resp.json()
                    person = data.get("person") or {}
                    return person.get("email")
        except Exception as e:
            log.warning(f"Apollo lookup failed: {e}")
            return None

    async def _hunter_find_email(self, domain: str) -> str | None:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"https://api.hunter.io/v2/domain-search?domain={domain}&api_key={self.hunter_key}",
                    timeout=15,
                ) as resp:
                    if resp.status != 200:
                        return None
                    data = await resp.json()
                    emails = data.get("data", {}).get("emails", [])
                    if emails:
                        return emails[0].get("value")
        except Exception as e:
            log.warning(f"Hunter lookup failed: {e}")
            return None

    async def generate_email_patterns(self, name: str, domain: str) -> str | None:
        parts = name.split()
        first = parts[0].lower() if parts else ""
        last = parts[-1].lower() if len(parts) > 1 else ""
        patterns = [
            f"{first}.{last}@{domain}" if last else None,
            f"{first}@{domain}" if first else None,
            f"{first[0]}{last}@{domain}" if first and last else None,
            f"{first}{last}@{domain}" if first and last else None,
        ]
        for email in patterns:
            if email and await self.validate_email_dns(email):
                return email
        return None

    async def validate_email_dns(self, email: str | None) -> bool:
        if not email:
            return False
        try:
            validate_email(email, check_deliverability=False)
            domain = email.split("@")[1]
            dns.resolver.resolve(domain, "MX")
            return True
        except (EmailNotValidError, Exception):
            return False

    def validate_phone(self, phone: str | None) -> bool:
        if not phone:
            return False
        digits = re.sub(r"\D", "", phone)
        return 7 <= len(digits) <= 15

    async def find_phone(self, company: str) -> str | None:
        return None

    async def fetch_company_data(self, website: str) -> dict[str, Any]:
        return {"website": website}

    def _extract_domain(self, value: str | None) -> str | None:
        if not value:
            return None
        value = value.replace("https://", "").replace("http://", "").split("/")[0]
        if "." in value and " " not in value:
            return value
        return None
