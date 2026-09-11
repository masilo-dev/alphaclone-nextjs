"""Language detection and multi-language NLP support."""

from __future__ import annotations

from langdetect import detect, LangDetectException

SUPPORTED_LANGS = [
    "en", "es", "fr", "de", "it", "pt", "ru", "ja", "zh", "ko",
    "ar", "th", "vi", "pl", "nl", "sv", "da", "fi", "tr", "el",
]

SPACY_MODELS = {
    "en": "en_core_web_sm",
    "fr": "fr_core_news_sm",
    "es": "es_core_news_sm",
    "de": "de_core_news_sm",
}


def detect_language(text: str) -> str:
    if not text or not text.strip():
        return "en"
    try:
        lang = detect(text)
        return lang if lang in SUPPORTED_LANGS else "en"
    except LangDetectException:
        return "en"
