"""Text classification for industry and seniority."""

from __future__ import annotations

from typing import Any


class TextClassifier:
    def __init__(self) -> None:
        self._classifier = None

    def _get_classifier(self):
        if self._classifier is None:
            from utils.config import get_settings
            if not get_settings().enable_ml_scoring:
                return None
            from transformers import pipeline
            self._classifier = pipeline("zero-shot-classification")
        return self._classifier

    async def classify(self, text: str, categories: list[str]) -> dict[str, Any]:
        classifier = self._get_classifier()
        if not classifier:
            return {"labels": categories[:1], "scores": [1.0]}
        result = classifier(text[:512], candidate_labels=categories)
        return result
