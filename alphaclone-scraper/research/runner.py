"""Asynchronous execution runner and job manager for Scrapy Web Research."""

from __future__ import annotations

import asyncio
import logging
from typing import Any
from urllib.parse import urlparse

from research.security import is_safe_url, sanitize_extracted_text

logger = logging.getLogger("alphaclone.research_runner")

_ACTIVE_JOBS: dict[str, dict[str, Any]] = {}


class ResearchRunner:
    """Manages asynchronous web research jobs with Scrapy and resilient HTTP fallback."""

    def __init__(self):
        self.active_jobs = _ACTIVE_JOBS

    async def start_research_crawl(
        self,
        research_job_id: str,
        tenant_id: str,
        target_urls: list[str],
        max_pages_per_domain: int = 4,
        timeout_seconds: int = 15,
    ) -> dict[str, Any]:
        """Start an asynchronous crawl job over target URLs."""
        if research_job_id in self.active_jobs:
            return {"status": "already_running", "research_job_id": research_job_id}

        job_state = {
            "research_job_id": research_job_id,
            "tenant_id": tenant_id,
            "status": "crawling",
            "progress": 0,
            "total_targets": len(target_urls),
            "processed_count": 0,
            "discovered_count": 0,
            "error_count": 0,
            "is_cancelled": False,
            "results": {},
        }
        self.active_jobs[research_job_id] = job_state

        asyncio.create_task(
            self._execute_crawl(
                research_job_id=research_job_id,
                tenant_id=tenant_id,
                target_urls=target_urls,
                max_pages_per_domain=max_pages_per_domain,
                timeout_seconds=timeout_seconds,
            )
        )

        return {"status": "started", "research_job_id": research_job_id}

    def cancel_job(self, research_job_id: str) -> bool:
        """Cancel an in-flight research crawl."""
        if research_job_id in self.active_jobs:
            self.active_jobs[research_job_id]["is_cancelled"] = True
            self.active_jobs[research_job_id]["status"] = "cancelled"
            logger.info(f"Research job {research_job_id} marked as cancelled")
            return True
        return False

    def get_job_status(self, research_job_id: str) -> dict[str, Any] | None:
        return self.active_jobs.get(research_job_id)

    async def _execute_crawl(
        self,
        research_job_id: str,
        tenant_id: str,
        target_urls: list[str],
        max_pages_per_domain: int,
        timeout_seconds: int,
    ) -> None:
        state = self.active_jobs.get(research_job_id)
        if not state:
            return

        try:
            import aiohttp
            from bs4 import BeautifulSoup
            import re

            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (AlphaClone Business Research Bot)"
                ),
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }

            email_regex = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
            phone_regex = re.compile(r"(?:\+?\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?){2,}\d{3,4}")

            timeout = aiohttp.ClientTimeout(total=timeout_seconds)
            connector = aiohttp.TCPConnector(limit_per_host=2, ssl=False)

            async with aiohttp.ClientSession(headers=headers, timeout=timeout, connector=connector) as session:
                for idx, raw_url in enumerate(target_urls):
                    if state.get("is_cancelled"):
                        logger.info(f"Crawl halted due to cancellation for {research_job_id}")
                        break

                    url = raw_url.strip()
                    if not url.startswith(("http://", "https://")):
                        url = f"https://{url}"

                    safe, reason = is_safe_url(url)
                    if not safe:
                        logger.warning(f"Skipping unsafe URL {url}: {reason}")
                        state["error_count"] += 1
                        state["processed_count"] += 1
                        continue

                    domain = urlparse(url).netloc.lower().replace("www.", "")
                    record = {
                        "business_name": "",
                        "website": url,
                        "domain": domain,
                        "public_email": None,
                        "email_status": "not_found",
                        "public_phone": None,
                        "location": "",
                        "industry": "",
                        "description": "",
                        "services": [],
                        "contact_page": None,
                        "about_page": None,
                        "linkedin_url": None,
                        "facebook_url": None,
                        "instagram_url": None,
                        "other_social_urls": [],
                        "source_urls": [url],
                        "source_type": "public_website",
                        "activity_signals": ["https_verified" if "https://" in url else "http"],
                        "raw_evidence": {},
                    }

                    # Crawl homepage + priority subpages
                    urls_to_try = [url, f"https://{domain}/contact", f"https://{domain}/about"][:max_pages_per_domain]

                    for page_url in urls_to_try:
                        try:
                            async with session.get(page_url, allow_redirects=True) as resp:
                                if resp.status != 200:
                                    continue
                                content_type = resp.headers.get("Content-Type", "")
                                if "text/html" not in content_type and "text/plain" not in content_type:
                                    continue

                                html = await resp.text(errors="replace")
                                soup = BeautifulSoup(html, "html.parser")
                                text = soup.get_text(" ")

                                if page_url not in record["source_urls"]:
                                    record["source_urls"].append(page_url)

                                # Business name from title or og:site_name
                                if not record["business_name"]:
                                    og_site = soup.find("meta", property="og:site_name")
                                    if og_site and og_site.get("content"):
                                        record["business_name"] = sanitize_extracted_text(og_site["content"], 80)
                                    elif soup.title and soup.title.string:
                                        clean_title = soup.title.string.split("|")[0].split("-")[0].strip()
                                        record["business_name"] = sanitize_extracted_text(clean_title, 80)

                                # Description
                                if not record["description"]:
                                    meta_desc = soup.find("meta", attrs={"name": "description"})
                                    if meta_desc and meta_desc.get("content"):
                                        record["description"] = sanitize_extracted_text(meta_desc["content"], 300)

                                # Mailto links
                                for mailto in soup.select('a[href^="mailto:"]'):
                                    href = mailto.get("href", "")
                                    raw_em = href.replace("mailto:", "").split("?")[0].strip().lower()
                                    if "@" in raw_em and not any(x in raw_em for x in ["noreply", "example.com", "sentry"]):
                                        record["public_email"] = raw_em
                                        record["email_status"] = "found"
                                        record["raw_evidence"]["email_source"] = page_url
                                        break

                                # Fallback body email regex
                                if not record["public_email"]:
                                    emails = email_regex.findall(text)
                                    for em in emails:
                                        em_clean = em.lower().strip()
                                        if not any(x in em_clean for x in ["noreply", "example.com", "sentry", "wix"]):
                                            record["public_email"] = em_clean
                                            record["email_status"] = "found"
                                            record["raw_evidence"]["email_source"] = page_url
                                            break

                                # Phone
                                if not record["public_phone"]:
                                    tel = soup.select_one('a[href^="tel:"]')
                                    if tel and tel.get("href"):
                                        record["public_phone"] = tel["href"].replace("tel:", "").strip()[:30]
                                    else:
                                        phones = phone_regex.findall(text)
                                        if phones and len(re.sub(r"\D", "", phones[0])) >= 7:
                                            record["public_phone"] = phones[0].strip()[:30]

                                # Social
                                for a in soup.find_all("a", href=True):
                                    href = a["href"]
                                    if "linkedin.com/company" in href and not record["linkedin_url"]:
                                        record["linkedin_url"] = href
                                    elif "facebook.com/" in href and not record["facebook_url"]:
                                        if "sharer" not in href:
                                            record["facebook_url"] = href
                                    elif "instagram.com/" in href and not record["instagram_url"]:
                                        record["instagram_url"] = href

                        except Exception as page_err:
                            logger.debug(f"Error fetching page {page_url}: {page_err}")

                    state["processed_count"] += 1
                    state["discovered_count"] += 1
                    state["results"][domain] = record
                    state["progress"] = min(99, int((state["processed_count"] / max(1, state["total_targets"])) * 100))

                    # Rate limit pause between distinct domains
                    await asyncio.sleep(0.4)

            state["status"] = "completed" if not state.get("is_cancelled") else "cancelled"
            state["progress"] = 100
            logger.info(f"Research job {research_job_id} crawl finished with {len(state['results'])} targets")

        except Exception as exc:
            logger.error(f"Research crawl failed for {research_job_id}: {exc}")
            state["status"] = "failed"
            state["error_message"] = str(exc)
