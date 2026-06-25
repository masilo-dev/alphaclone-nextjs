"""Alphaclone Python Lead Scraper — FastAPI entry point."""

from fastapi import FastAPI

from api.routes import router
from utils.logging import log, setup_logging

setup_logging()

app = FastAPI(
    title="Alphaclone Lead Scraper",
    description="Playwright + ML lead scraping microservice",
    version="1.0.0",
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "alphaclone-scraper"}


@app.on_event("startup")
async def startup():
    log.info("alphaclone-scraper starting")
