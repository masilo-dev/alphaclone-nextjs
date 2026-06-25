"""FastAPI route handlers."""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException

from api.models import CampaignRunRequest, CampaignStatusResponse, EnrichRequest, ScrapeRequest
from utils.cache import cache
from utils.config import get_settings
from utils.db import get_supabase
from workers.enricher import EnricherWorker
from workers.orchestrator import CampaignOrchestrator

router = APIRouter()
orchestrator = CampaignOrchestrator()
enricher = EnricherWorker()


def verify_internal_key(x_internal_api_key: str = Header(default="")) -> None:
    key = get_settings().internal_api_key
    if key and x_internal_api_key != key:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/api/scraper/campaign/run", dependencies=[Depends(verify_internal_key)])
async def run_campaign(req: CampaignRunRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(orchestrator.run_campaign, req.campaign_id)
    return {"status": "started", "campaign_id": req.campaign_id}


@router.get(
    "/api/scraper/status/{campaign_id}",
    response_model=CampaignStatusResponse,
    dependencies=[Depends(verify_internal_key)],
)
async def campaign_status(campaign_id: str):
    cached = await cache.get(f"campaign_status:{campaign_id}")
    if cached:
        return CampaignStatusResponse(campaign_id=campaign_id, **cached)

    db = get_supabase()
    if db:
        result = (
            db.table("lead_campaign_runs")
            .select("*")
            .eq("campaign_id", campaign_id)
            .order("run_at", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            run = result.data[0]
            return CampaignStatusResponse(
                campaign_id=campaign_id,
                status=run.get("status", "unknown"),
                progress=run.get("progress", 0),
                source_count=run.get("source_count", 0),
                enriched_count=run.get("enriched_count", 0),
                created_count=run.get("created_count", 0),
                current_step=run.get("current_step", "init"),
                errors=run.get("errors") or [],
            )

    return CampaignStatusResponse(campaign_id=campaign_id, status="unknown")


@router.post("/api/scraper/campaign/poll", dependencies=[Depends(verify_internal_key)])
async def poll_campaigns(background_tasks: BackgroundTasks):
    background_tasks.add_task(orchestrator.poll_active_campaigns)
    return {"status": "polling"}


@router.post("/api/scraper/scrape", dependencies=[Depends(verify_internal_key)])
async def scrape_on_demand(req: ScrapeRequest):
    raw_leads = []
    for source in req.sources:
        scraper = orchestrator._get_scraper(source)
        if scraper:
            leads = await scraper.scrape(req.config)
            raw_leads.extend(leads)
            if hasattr(scraper, "close"):
                await scraper.close()
    extracted = await orchestrator.extractor.extract_entities(raw_leads)
    return {"leads": extracted, "count": len(extracted)}


@router.post("/api/scraper/enrich", dependencies=[Depends(verify_internal_key)])
async def enrich_on_demand(req: EnrichRequest):
    enriched = await enricher.enrich_batch(req.leads, req.enrichment_level)
    return {"leads": enriched, "count": len(enriched)}
