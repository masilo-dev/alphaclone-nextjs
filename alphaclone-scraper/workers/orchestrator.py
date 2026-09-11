"""Campaign orchestration pipeline."""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from api.mcp_sync import MCPSync
from nlp.entity_extractor import MLExtractor
from strategies.custom_strategy import CustomScraper
from strategies.directory_strategy import DirectoryScraper
from strategies.github_strategy import GitHubScraper
from strategies.job_boards_strategy import JobBoardScraper
from strategies.linkedin_strategy import LinkedInScraper
from strategies.social_strategy import SocialScraper
from strategies.website_strategy import WebsiteScraper
from utils.cache import cache
from utils.db import get_supabase
from utils.logging import log
from workers.deduplicator import Deduplicator
from workers.enricher import EnricherWorker
from workers.validator import LeadValidator

SCRAPER_MAP = {
    "website": WebsiteScraper,
    "directory": DirectoryScraper,
    "github": GitHubScraper,
    "linkedin": LinkedInScraper,
    "twitter": SocialScraper,
    "social": SocialScraper,
    "job_boards": JobBoardScraper,
    "custom": CustomScraper,
}


class CampaignOrchestrator:
    def __init__(self) -> None:
        self.enricher = EnricherWorker()
        self.extractor = MLExtractor()
        self.deduplicator = Deduplicator()
        self.validator = LeadValidator()
        self.mcp_sync = MCPSync()
        self._scrapers: dict[str, Any] = {}

    def _get_scraper(self, source: str):
        if source not in self._scrapers:
            cls = SCRAPER_MAP.get(source)
            if cls:
                self._scrapers[source] = cls()
        return self._scrapers.get(source)

    async def run_campaign(self, campaign_id: str, config: dict[str, Any] | None = None) -> dict[str, Any]:
        start = time.monotonic()
        run_id = str(uuid4())
        db = get_supabase()

        campaign = await self._load_campaign(campaign_id, db)
        if not campaign:
            return {"error": "Campaign not found", "campaign_id": campaign_id}

        cfg = {**campaign, **(config or {})}
        tenant_id = campaign.get("tenant_id")
        user_id = campaign.get("created_by")

        await self._update_run(db, run_id, campaign_id, tenant_id, {
            "status": "running",
            "current_step": "scraping",
            "progress": 5,
        })

        raw_leads: list[dict[str, Any]] = []
        sources = cfg.get("sources") or [cfg.get("source", "website")]
        if isinstance(sources, str):
            sources = [sources]

        errors: list[str] = []
        for source in sources:
            scraper = self._get_scraper(source)
            if not scraper:
                errors.append(f"Unknown source: {source}")
                continue
            try:
                leads = await scraper.scrape(cfg)
                for lead in leads:
                    lead["campaign_id"] = campaign_id
                    lead["tenant_id"] = tenant_id
                    lead["source"] = lead.get("source", source)
                raw_leads.extend(leads)
                await self._save_raw_leads(db, leads, campaign_id, tenant_id, source)
            except Exception as e:
                log.error(f"Scrape error ({source}): {e}")
                errors.append(f"{source}: {str(e)}")
            finally:
                if hasattr(scraper, "close"):
                    await scraper.close()

        await self._update_run(db, run_id, campaign_id, tenant_id, {
            "current_step": "extracting",
            "progress": 30,
            "source_count": len(raw_leads),
        })

        extracted = await self.extractor.extract_entities(raw_leads)

        await self._update_run(db, run_id, campaign_id, tenant_id, {
            "current_step": "enriching",
            "progress": 50,
        })

        enrichment_level = cfg.get("enrichment_level", "full")
        enriched = await self.enricher.enrich_batch(extracted, enrichment_level)

        await self._update_run(db, run_id, campaign_id, tenant_id, {
            "current_step": "deduplicating",
            "progress": 65,
            "enriched_count": len(enriched),
        })

        unique = await self.deduplicator.deduplicate(enriched)

        await self._update_run(db, run_id, campaign_id, tenant_id, {
            "current_step": "scoring",
            "progress": 80,
        })

        qualified = await self.validator.validate_and_score(unique, cfg)
        scraper_lead_ids = await self._save_scraper_leads(db, qualified, campaign_id, tenant_id)

        for lead, lid in zip(qualified, scraper_lead_ids):
            lead["id"] = lid

        await self._update_run(db, run_id, campaign_id, tenant_id, {
            "current_step": "syncing",
            "progress": 90,
        })

        created = []
        if tenant_id and user_id:
            created = await self.mcp_sync.sync_leads_to_mcp(
                qualified, campaign_id, tenant_id, user_id
            )
            await self._update_crm_ids(db, created)

        duration = int(time.monotonic() - start)
        await self._update_run(db, run_id, campaign_id, tenant_id, {
            "status": "completed",
            "current_step": "done",
            "progress": 100,
            "created_count": len(created),
            "errors": errors,
            "duration_seconds": duration,
        })

        await cache.set(f"campaign_status:{campaign_id}", {
            "status": "completed",
            "progress": 100,
            "source_count": len(raw_leads),
            "enriched_count": len(enriched),
            "created_count": len(created),
        })

        return {
            "campaign_id": campaign_id,
            "run_id": run_id,
            "source_count": len(raw_leads),
            "enriched_count": len(enriched),
            "qualified_count": len(qualified),
            "created_count": len(created),
            "errors": errors,
            "duration_seconds": duration,
        }

    async def poll_active_campaigns(self) -> list[dict[str, Any]]:
        db = get_supabase()
        if not db:
            return []
        result = (
            db.table("scraper_campaigns")
            .select("*")
            .eq("status", "active")
            .limit(10)
            .execute()
        )
        results = []
        for campaign in result.data or []:
            r = await self.run_campaign(campaign["id"])
            results.append(r)
        return results

    async def _load_campaign(self, campaign_id: str, db) -> dict[str, Any] | None:
        if not db:
            return None
        result = db.table("scraper_campaigns").select("*").eq("id", campaign_id).single().execute()
        return result.data

    async def _update_run(
        self, db, run_id: str, campaign_id: str, tenant_id: str | None, fields: dict[str, Any]
    ) -> None:
        if not db:
            return
        payload = {
            "id": run_id,
            "campaign_id": campaign_id,
            "tenant_id": tenant_id,
            "run_at": datetime.now(timezone.utc).isoformat(),
            **fields,
        }
        db.table("lead_campaign_runs").upsert(payload).execute()
        await cache.set(f"campaign_status:{campaign_id}", {
            "status": fields.get("status", "running"),
            "progress": fields.get("progress", 0),
            "current_step": fields.get("current_step", "init"),
            "source_count": fields.get("source_count", 0),
            "enriched_count": fields.get("enriched_count", 0),
            "created_count": fields.get("created_count", 0),
        })

    async def _save_raw_leads(
        self, db, leads: list[dict], campaign_id: str, tenant_id: str | None, source: str
    ) -> None:
        if not db or not leads:
            return
        rows = [
            {
                "campaign_id": campaign_id,
                "tenant_id": tenant_id,
                "source": source,
                "raw_data": lead,
            }
            for lead in leads
        ]
        db.table("leads_raw").insert(rows).execute()

    async def _save_scraper_leads(
        self, db, leads: list[dict], campaign_id: str, tenant_id: str | None
    ) -> list[str]:
        if not db or not leads:
            return []
        ids = []
        for lead in leads:
            row = {
                "campaign_id": campaign_id,
                "tenant_id": tenant_id,
                "email": lead.get("email"),
                "phone": lead.get("phone"),
                "name": lead.get("name"),
                "title": lead.get("title"),
                "company": lead.get("company"),
                "company_website": lead.get("company_website"),
                "industry": lead.get("industry"),
                "linkedin_url": lead.get("linkedin_url"),
                "source": lead.get("source"),
                "score": lead.get("score"),
                "grade": lead.get("grade"),
                "quality_reason": lead.get("quality_reason"),
                "status": "new",
                "enriched_at": datetime.now(timezone.utc).isoformat(),
            }
            result = db.table("scraper_leads").insert(row).execute()
            if result.data:
                ids.append(result.data[0]["id"])
        return ids

    async def _update_crm_ids(self, db, created: list[dict]) -> None:
        if not db:
            return
        for item in created:
            scraper_lead_id = item.get("scraper_lead_id")
            crm_lead_id = item.get("crm_lead_id")
            if scraper_lead_id and crm_lead_id:
                db.table("scraper_leads").update({
                    "crm_lead_id": crm_lead_id,
                    "status": "synced",
                }).eq("id", scraper_lead_id).execute()
