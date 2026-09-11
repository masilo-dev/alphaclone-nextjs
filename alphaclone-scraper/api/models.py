"""Pydantic request/response models."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CampaignRunRequest(BaseModel):
    campaign_id: str
    tenant_id: str | None = None
    user_id: str | None = None


class ScrapeRequest(BaseModel):
    sources: list[str] = Field(default=["website", "directory"])
    config: dict[str, Any] = Field(default_factory=dict)


class EnrichRequest(BaseModel):
    leads: list[dict[str, Any]]
    enrichment_level: str = "full"


class CampaignStatusResponse(BaseModel):
    campaign_id: str
    status: str
    progress: int = 0
    source_count: int = 0
    enriched_count: int = 0
    created_count: int = 0
    current_step: str = "init"
    errors: list[Any] = Field(default_factory=list)
