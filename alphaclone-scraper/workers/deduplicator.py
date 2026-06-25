"""Lead deduplication."""

from __future__ import annotations

from typing import Any


class Deduplicator:
    async def deduplicate(self, leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
        seen: set[tuple[str, str]] = set()
        unique: list[dict[str, Any]] = []

        for lead in leads:
            email = (lead.get("email") or "").lower().strip()
            company = (lead.get("company") or "").lower().strip()
            key = (email, company)

            if key == ("", ""):
                name = (lead.get("name") or "").lower()
                key = (name, company)
                if key == ("", ""):
                    continue

            if key not in seen:
                seen.add(key)
                unique.append(lead)

        return unique
