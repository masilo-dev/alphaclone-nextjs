"""Scrapy Spider for business website research and lead extraction."""

from __future__ import annotations

import json
import re
from typing import Any, Generator
from urllib.parse import urljoin, urlparse

try:
    import scrapy
    from scrapy.http import Response
except ImportError:
    # If Scrapy is not installed in the current environment, provide a stub
    class _ScrapyStub:
        Spider = object
    scrapy = _ScrapyStub()  # type: ignore

from research.security import is_safe_url, sanitize_extracted_text

EMAIL_REGEX = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
PHONE_REGEX = re.compile(r"(?:\+?\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?){2,}\d{3,4}")

IGNORE_EMAIL_SUBSTRINGS = [
    "noreply", "no-reply", "donotreply", "example.com", "sentry.io",
    "wixpress.com", "godaddy.com", "domain.com", "schema.org", "w3.org",
    "gravatar.com", "wordpress.org", "cloudflare.com"
]

HIGH_VALUE_PATHS = [
    "/contact", "/contact-us", "/about", "/about-us", "/services",
    "/our-services", "/team", "/about-the-team", "/company"
]


class BusinessResearchSpider(scrapy.Spider):
    name = "business_research"

    custom_settings = {
        "ROBOTSTXT_OBEY": True,
        "DOWNLOAD_DELAY": 0.75,
        "CONCURRENT_REQUESTS_PER_DOMAIN": 2,
        "DOWNLOAD_TIMEOUT": 12,
        "DEPTH_LIMIT": 2,
        "USER_AGENT": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (AlphaClone Business Research Bot)"
        ),
        "TELNETCONSOLE_ENABLED": False,
    }

    def __init__(
        self,
        start_urls: list[str] | str,
        research_job_id: str = "",
        tenant_id: str = "",
        max_pages_per_domain: int = 4,
        *args: Any,
        **kwargs: Any,
    ):
        super().__init__(*args, **kwargs)
        if isinstance(start_urls, str):
            try:
                self.start_urls = json.loads(start_urls)
            except Exception:
                self.start_urls = [start_urls]
        else:
            self.start_urls = list(start_urls)

        self.research_job_id = research_job_id
        self.tenant_id = tenant_id
        self.max_pages_per_domain = max_pages_per_domain
        self.domain_pages_crawled: dict[str, int] = {}
        self.results: dict[str, dict[str, Any]] = {}

    def start_requests(self) -> Generator[Any, None, None]:
        for raw_url in self.start_urls:
            url = raw_url.strip()
            if not url.startswith(("http://", "https://")):
                url = f"https://{url}"

            safe, reason = is_safe_url(url)
            if not safe:
                self.logger.warning(f"Skipping unsafe URL {url}: {reason}")
                continue

            parsed = urlparse(url)
            domain = parsed.netloc.lower().replace("www.", "")

            # Initialize research record for this domain
            self.results[domain] = {
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
                "activity_signals": [],
                "raw_evidence": {},
            }
            self.domain_pages_crawled[domain] = 0

            yield scrapy.Request(
                url=url,
                callback=self.parse_homepage,
                meta={"domain": domain, "depth": 0},
                errback=self.handle_error,
                dont_filter=False,
            )

    def parse_homepage(self, response: Response) -> Generator[Any, None, None]:
        domain = response.meta.get("domain")
        if not domain or domain not in self.results:
            return

        self.domain_pages_crawled[domain] += 1
        record = self.results[domain]
        current_url = response.url

        if current_url not in record["source_urls"]:
            record["source_urls"].append(current_url)

        # Extract metadata and text
        html = response.text
        self._extract_page_data(response, record, is_home=True)

        # Find internal high-priority links (contact, about, services)
        if self.domain_pages_crawled[domain] < self.max_pages_per_domain:
            links = response.css("a::attr(href)").getall()
            for href in links:
                if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                    continue

                full_url = urljoin(current_url, href)
                parsed_full = urlparse(full_url)
                link_domain = parsed_full.netloc.lower().replace("www.", "")

                # Internal domain link only
                if link_domain == domain:
                    path = parsed_full.path.lower().rstrip("/")
                    is_high_value = any(target in path for target in HIGH_VALUE_PATHS)

                    if is_high_value and full_url not in record["source_urls"]:
                        if self.domain_pages_crawled[domain] >= self.max_pages_per_domain:
                            break

                        safe, _ = is_safe_url(full_url)
                        if safe:
                            yield scrapy.Request(
                                url=full_url,
                                callback=self.parse_subpage,
                                meta={"domain": domain, "depth": 1},
                                errback=self.handle_error,
                            )

    def parse_subpage(self, response: Response) -> None:
        domain = response.meta.get("domain")
        if not domain or domain not in self.results:
            return

        self.domain_pages_crawled[domain] += 1
        record = self.results[domain]
        current_url = response.url

        if current_url not in record["source_urls"]:
            record["source_urls"].append(current_url)

        self._extract_page_data(response, record, is_home=False)

    def _extract_page_data(self, response: Response, record: dict[str, Any], is_home: bool) -> None:
        current_url = response.url
        path_lower = urlparse(current_url).path.lower()

        # Mark contact / about pages
        if any(x in path_lower for x in ["/contact", "/contact-us"]):
            record["contact_page"] = current_url
        elif any(x in path_lower for x in ["/about", "/about-us", "/company"]):
            record["about_page"] = current_url

        # 1. Business Name (primarily on homepage)
        if is_home or not record["business_name"]:
            # Check JSON-LD
            for script in response.css('script[type="application/ld+json"]::text').getall():
                try:
                    data = json.loads(script)
                    items = data if isinstance(data, list) else [data]
                    for item in items:
                        if isinstance(item, dict) and item.get("@type") in ("Organization", "LocalBusiness", "Corporation"):
                            name = item.get("name")
                            if name and isinstance(name, str) and len(name.strip()) > 1:
                                record["business_name"] = sanitize_extracted_text(name, 80)
                                record["raw_evidence"]["name_source"] = "schema_json_ld"
                                break
                except Exception:
                    pass

            # Fallback to OG site_name or title
            if not record["business_name"]:
                og_name = response.css('meta[property="og:site_name"]::attr(content)').get()
                if og_name and len(og_name.strip()) > 1:
                    record["business_name"] = sanitize_extracted_text(og_name, 80)
                    record["raw_evidence"]["name_source"] = "og_site_name"
                else:
                    title = response.css("title::text").get()
                    if title:
                        clean_title = title.split("|")[0].split("-")[0].split("—")[0].strip()
                        if clean_title:
                            record["business_name"] = sanitize_extracted_text(clean_title, 80)
                            record["raw_evidence"]["name_source"] = "page_title"

        # 2. Description
        if not record["description"]:
            meta_desc = (
                response.css('meta[name="description"]::attr(content)').get()
                or response.css('meta[property="og:description"]::attr(content)').get()
            )
            if meta_desc:
                record["description"] = sanitize_extracted_text(meta_desc, 300)

        # 3. Public Email Extraction
        html_text = response.text
        # Search mailto: links first (highest quality signal)
        mailto_links = response.css('a[href^="mailto:"]::attr(href)').getall()
        for link in mailto_links:
            raw_email = link.replace("mailto:", "").split("?")[0].strip().lower()
            if self._is_valid_public_email(raw_email):
                record["public_email"] = raw_email
                record["email_status"] = "found"
                record["raw_evidence"]["email_source"] = current_url
                break

        # If not found in mailto, scan body text
        if not record["public_email"]:
            body_text = " ".join(response.css("p, div, span, footer, a::text").getall())
            matches = EMAIL_REGEX.findall(body_text)
            for m in matches:
                clean_email = m.strip().lower()
                if self._is_valid_public_email(clean_email):
                    record["public_email"] = clean_email
                    record["email_status"] = "found"
                    record["raw_evidence"]["email_source"] = current_url
                    break

        # 4. Public Phone Extraction
        tel_links = response.css('a[href^="tel:"]::attr(href)').getall()
        if tel_links and not record["public_phone"]:
            raw_tel = tel_links[0].replace("tel:", "").strip()
            record["public_phone"] = raw_tel[:30]
            record["raw_evidence"]["phone_source"] = current_url
        elif not record["public_phone"]:
            body_phones = PHONE_REGEX.findall(" ".join(response.css("header, footer, .contact, .footer::text").getall()))
            if body_phones:
                candidate_phone = body_phones[0].strip()
                if len(re.sub(r"\D", "", candidate_phone)) >= 7:
                    record["public_phone"] = candidate_phone[:30]
                    record["raw_evidence"]["phone_source"] = current_url

        # 5. Social Links
        for href in response.css("a::attr(href)").getall():
            if not href:
                continue
            h_lower = href.lower()
            if "linkedin.com/company" in h_lower and not record["linkedin_url"]:
                record["linkedin_url"] = href
            elif ("facebook.com/" in h_lower or "fb.me/" in h_lower) and not record["facebook_url"]:
                if not any(x in h_lower for x in ["sharer", "share.php"]):
                    record["facebook_url"] = href
            elif "instagram.com/" in h_lower and not record["instagram_url"]:
                record["instagram_url"] = href
            elif any(s in h_lower for s in ["twitter.com/", "x.com/", "youtube.com/"]):
                if href not in record["other_social_urls"]:
                    record["other_social_urls"].append(href)

        # 6. Activity Signals
        if "https://" in current_url:
            if "ssl_active" not in record["activity_signals"]:
                record["activity_signals"].append("ssl_active")
        if response.css('meta[name="viewport"]').get():
            if "mobile_viewport" not in record["activity_signals"]:
                record["activity_signals"].append("mobile_viewport")

    def _is_valid_public_email(self, email: str) -> bool:
        if not email or "@" not in email:
            return False
        email_clean = email.strip().lower()
        if any(ign in email_clean for ign in IGNORE_EMAIL_SUBSTRINGS):
            return False
        # Avoid file extensions falsely identified as emails (e.g. image@2x.png)
        if email_clean.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js")):
            return False
        return bool(EMAIL_REGEX.match(email_clean))

    def handle_error(self, failure: Any) -> None:
        url = getattr(failure.request, "url", "unknown")
        self.logger.warning(f"Request failed for {url}: {failure.value}")
