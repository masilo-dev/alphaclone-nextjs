"""MCP sync via Next.js internal API."""

from __future__ import annotations

from typing import Any

import aiohttp

from utils.config import get_settings
from utils.logging import log


class MCPSync:
    def __init__(self) -> None:
        s = get_settings()
        self.mcp_sync_url = s.mcp_sync_url
        self.internal_api_key = s.internal_api_key

    async def sync_leads_to_mcp(
        self,
        leads: list[dict[str, Any]],
        campaign_id: str,
        tenant_id: str,
        user_id: str,
    ) -> list[dict[str, Any]]:
        if not self.mcp_sync_url:
            log.warning("MCP_SYNC_URL not configured, skipping sync")
            return []

        created: list[dict[str, Any]] = []
        batch_size = 50

        for i in range(0, len(leads), batch_size):
            batch = leads[i : i + batch_size]
            payload = {
                "tenantId": tenant_id,
                "userId": user_id,
                "campaignId": campaign_id,
                "leads": [
                    {
                        "scraper_lead_id": lead.get("id"),
                        "contact_name": lead.get("name"),
                        "email": lead.get("email"),
                        "phone": lead.get("phone"),
                        "business_name": lead.get("company"),
                        "industry": lead.get("industry"),
                        "location": lead.get("location"),
                        "source": lead.get("source"),
                        "score": lead.get("score"),
                        "grade": lead.get("grade"),
                        "notes": lead.get("quality_reason"),
                    }
                    for lead in batch
                ],
            }

            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        self.mcp_sync_url,
                        json=payload,
                        headers={
                            "Content-Type": "application/json",
                            "x-internal-api-key": self.internal_api_key,
                        },
                        timeout=120,
                    ) as resp:
                        if resp.status != 200:
                            text = await resp.text()
                            log.error(f"MCP sync failed ({resp.status}): {text}")
                            continue
                        data = await resp.json()
                        created.extend(data.get("created", []))
            except Exception as e:
                log.error(f"MCP sync batch error: {e}")

        return created
