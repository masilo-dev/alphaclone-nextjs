"""spaCy NER entity extraction with multi-language support."""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

import spacy

from nlp.language_detector import SPACY_MODELS, detect_language
from utils.logging import log

EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERNS = {
    "us": re.compile(r"(\+1|1)?[-.\s]?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}"),
    "intl": re.compile(r"\+[0-9]{1,3}[-.\s]?[0-9]{6,14}"),
}


@lru_cache(maxsize=8)
def _load_nlp(lang: str):
    model_name = SPACY_MODELS.get(lang, "en_core_web_sm")
    try:
        return spacy.load(model_name)
    except OSError:
        log.warning(f"spaCy model {model_name} not found, falling back to en")
        return spacy.load("en_core_web_sm")


class MLExtractor:
    def __init__(self) -> None:
        self._classifier = None

    def _get_classifier(self):
        if self._classifier is None:
            from utils.config import get_settings
            if not get_settings().enable_ml_scoring:
                return None
            from transformers import pipeline
            self._classifier = pipeline(
                "zero-shot-classification",
                model="facebook/bart-large-mnli",
            )
        return self._classifier

    async def extract_entities(self, raw_leads: list[dict[str, Any]]) -> list[dict[str, Any]]:
        extracted = []
        for lead in raw_leads:
            text = lead.get("raw_text") or " ".join(
                str(lead.get(k, "")) for k in ("name", "title", "company", "bio")
            )
            lang = detect_language(text)
            nlp = _load_nlp(lang)
            doc = nlp(text[:10000])

            entities: dict[str, str | None] = {}
            for ent in doc.ents:
                if ent.label_ not in entities:
                    entities[ent.label_] = ent.text

            emails = list(set(EMAIL_PATTERN.findall(text)))
            phones: list[str] = []
            for pattern in PHONE_PATTERNS.values():
                phones.extend(pattern.findall(text))

            quality_score = await self._classify_quality(text)

            extracted.append({
                **lead,
                "name": lead.get("name") or entities.get("PERSON"),
                "company": lead.get("company") or entities.get("ORG"),
                "location": lead.get("location") or entities.get("GPE"),
                "emails": emails,
                "email": emails[0] if emails else lead.get("email"),
                "phones": phones,
                "phone": phones[0] if phones else lead.get("phone"),
                "quality_score": quality_score,
                "language": lang,
            })
        return extracted

    async def _classify_quality(self, text: str) -> float:
        classifier = self._get_classifier()
        if not classifier or not text.strip():
            return 0.5
        try:
            result = classifier(
                text[:512],
                candidate_labels=["high quality prospect", "low quality prospect"],
            )
            return float(result["scores"][0])
        except Exception:
            return 0.5
