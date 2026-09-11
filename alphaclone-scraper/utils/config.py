"""Application settings from environment variables."""

from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = Field(default=8000, alias="PORT")
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_key: str = Field(default="", alias="SUPABASE_KEY")
    internal_api_key: str = Field(default="", alias="INTERNAL_API_KEY")
    mcp_sync_url: str = Field(default="", alias="MCP_SYNC_URL")
    apollo_api_key: str = Field(default="", alias="APOLLO_API_KEY")
    hunter_api_key: str = Field(default="", alias="HUNTER_API_KEY")
    proxy_list: str = Field(default="", alias="PROXY_LIST")
    worker_concurrency: int = Field(default=3, alias="WORKER_CONCURRENCY")
    scrape_delay_min: float = Field(default=2.0, alias="SCRAPE_DELAY_MIN")
    scrape_delay_max: float = Field(default=10.0, alias="SCRAPE_DELAY_MAX")
    enable_ml_scoring: bool = Field(default=False, alias="ENABLE_ML_SCORING")
    upstash_redis_rest_url: str = Field(default="", alias="UPSTASH_REDIS_REST_URL")
    upstash_redis_rest_token: str = Field(default="", alias="UPSTASH_REDIS_REST_TOKEN")

    @property
    def proxies(self) -> list[str]:
        if not self.proxy_list:
            return []
        return [p.strip() for p in self.proxy_list.split(",") if p.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
