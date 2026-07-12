"""FastAPI route handlers."""

from __future__ import annotations

import re
from urllib.parse import urlparse

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


# ── Campaign endpoints ────────────────────────────────────────────────────────

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


# ── On-demand scrape / enrich ────────────────────────────────────────────────

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


# ── Domain enrichment ─────────────────────────────────────────────────────────
# Called by emailLeadAutoSearch.ts when a new sender domain arrives in the inbox.
# Performs best-effort email / contact discovery for the domain and is
# intentionally fire-and-forget (caller does not wait for a result).

class _DomainEnrichRequest(EnrichRequest.__class__.__bases__[0]):  # type: ignore[misc]
    """Minimal request body for domain enrichment."""
    from pydantic import BaseModel

    class _Body(BaseModel):
        tenant_id: str = ""
        domain: str
        email: str = ""
        subject: str = ""


from pydantic import BaseModel as _BaseModel


class DomainEnrichRequest(_BaseModel):
    tenant_id: str = ""
    domain: str
    email: str = ""
    subject: str = ""


_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
_PHONE_RE = re.compile(r"(?:\+?\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?){2,}\d{3,4}")


@router.post("/enrich/domain", dependencies=[Depends(verify_internal_key)])
async def enrich_domain(req: DomainEnrichRequest, background_tasks: BackgroundTasks):
    """
    Lightweight domain enrichment that scrapes the homepage + /contact page
    for email addresses and phone numbers.  Runs in the background so the
    caller (Next.js email sidebar) gets an immediate 202 response.
    """
    async def _run(domain: str, tenant_id: str) -> None:
        try:
            import aiohttp
            from bs4 import BeautifulSoup

            found_emails: list[str] = []
            found_phones: list[str] = []

            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
            }

            urls_to_scrape = [
                f"https://{domain}",
                f"https://{domain}/contact",
                f"https://{domain}/about",
            ]

            async with aiohttp.ClientSession(headers=headers) as session:
                for url in urls_to_scrape:
                    try:
                        async with session.get(
                            url,
                            timeout=aiohttp.ClientTimeout(total=15),
                            allow_redirects=True,
                            ssl=False,
                        ) as resp:
                            if resp.status != 200:
                                continue
                            html = await resp.text(errors="replace")
                            soup = BeautifulSoup(html, "html.parser")
                            text = soup.get_text(" ")

                            found_emails += _EMAIL_RE.findall(text)
                            found_phones += _PHONE_RE.findall(text)
                    except Exception:
                        pass

            # Deduplicate; filter out noreply / sentry / example domains
            clean_emails = list(dict.fromkeys(
                e.lower() for e in found_emails
                if not any(x in e.lower() for x in ["noreply", "no-reply", "example.com", "sentry.io"])
            ))
            clean_phones = list(dict.fromkeys(found_phones))

            # Persist to Supabase scraper_leads if we found something useful
            db = get_supabase()
            if db and (clean_emails or clean_phones) and tenant_id:
                db.table("scraper_leads").insert({
                    "tenant_id": tenant_id,
                    "email": clean_emails[0] if clean_emails else None,
                    "phone": clean_phones[0] if clean_phones else None,
                    "company": domain,
                    "company_website": f"https://{domain}",
                    "source": "domain_enrichment",
                    "status": "new",
                }).execute()

        except Exception as exc:
            import logging
            logging.getLogger("alphaclone.enrich").warning(f"Domain enrich failed for {domain}: {exc}")

    background_tasks.add_task(_run, req.domain, req.tenant_id)
    return {"status": "queued", "domain": req.domain}
