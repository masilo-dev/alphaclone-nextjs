"""Lead validation and rules-based scoring."""

from __future__ import annotations

import re
from typing import Any

DECISION_MAKER_TITLES = [
    "owner", "founder", "co-founder", "director", "manager", "head of",
    "principal", "partner", "president",
]

ENTERPRISE_PATTERNS = [
    re.compile(r"\b(google|microsoft|apple|amazon|meta|facebook|oracle|ibm|accenture)\b", re.I),
    re.compile(r"\b(fortune\s*500|enterprise|conglomerate|global\s+hq)\b", re.I),
    re.compile(r"\b(inc\.|corp\.|corporation|holdings)\b", re.I),
]


def _is_enterprise(lead: dict[str, Any]) -> bool:
    company = (lead.get("company") or lead.get("name") or "").lower()
    size = lead.get("company_size")
    if size and int(size) > 250:
        return True
    return any(p.search(company) for p in ENTERPRISE_PATTERNS)


class LeadValidator:
    async def validate_and_score(
        self, leads: list[dict[str, Any]], config: dict[str, Any]
    ) -> list[dict[str, Any]]:
        min_threshold = config.get("min_score_threshold", 40)
        scored: list[dict[str, Any]] = []

        for lead in leads:
            if _is_enterprise(lead):
                lead["score"] = 0
                lead["grade"] = "D"
                lead["quality_reason"] = "Excluded: enterprise/large corp (SMB-only)"
                continue

            score = 0
            reasons: list[str] = []

            if lead.get("email_valid"):
                score += 30
                reasons.append("valid email (+30)")
            elif lead.get("email"):
                score -= 5
                reasons.append("unverified email (-5)")

            if lead.get("phone_valid"):
                score += 15
                reasons.append("valid phone (+15)")

            title = (lead.get("title") or "").lower()
            title_keywords = [t.lower() for t in config.get("title_keywords") or []]
            if title_keywords and any(kw in title for kw in title_keywords):
                score += 25
                reasons.append("title match (+25)")
            elif any(dm in title for dm in DECISION_MAKER_TITLES):
                score += 15
                reasons.append("decision maker title (+15)")
            elif title:
                score += 5
                reasons.append("has title (+5)")

            company = (lead.get("company") or "").lower()
            industry = config.get("industry") or []
            if isinstance(industry, list):
                if any(ind.lower() in company for ind in industry):
                    score += 10
                    reasons.append("industry match (+10)")

            if lead.get("email"):
                score += 5
            if lead.get("phone"):
                score += 5
            if lead.get("linkedin_url"):
                score += 3

            target_lang = config.get("target_language", "en")
            if lead.get("language") == target_lang:
                score += 10

            ml_score = lead.get("quality_score")
            if ml_score and isinstance(ml_score, (int, float)) and ml_score > 0.7:
                score += 5
                reasons.append("ML quality boost (+5)")

            score = max(0, min(score, 100))
            lead["score"] = score
            lead["grade"] = self._grade_from_score(score)
            lead["quality_reason"] = "; ".join(reasons)

            if score >= min_threshold and not (
                lead.get("email") and lead.get("email_valid") is False
            ):
                scored.append(lead)

        return scored

    def _grade_from_score(self, score: int) -> str:
        if score >= 90:
            return "A"
        if score >= 70:
            return "B"
        if score >= 50:
            return "C"
        return "D"
