"""Alphaclone Python Lead Scraper — FastAPI entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.routes import router
from utils.logging import log, setup_logging

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("alphaclone-scraper starting")
    yield
    log.info("alphaclone-scraper shutting down")


app = FastAPI(
    title="Alphaclone Lead Scraper",
    description="Playwright + ML lead scraping microservice",
    version="1.1.0",
    lifespan=lifespan,
)

app.include_router(router)


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "alphaclone-scraper"}
