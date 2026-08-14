import os
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    dashboard,
    admin_lookup,
    admin_questions,
    admin_users,
    admin_overview,
    courses,
    uploads,
    questions,
    answers,
)
from app.services.extraction_worker import run_extraction_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the background extraction worker once, when the app boots.
    task = asyncio.create_task(run_extraction_worker())
    yield
    task.cancel()


app = FastAPI(title="SparkL API", lifespan=lifespan)

# Reads allowed origins from an env var in production (comma-separated),
# falls back to localhost for local dev. Avoids hardcoding a URL that
# breaks the moment the frontend is deployed somewhere new.
default_origins = "http://localhost:3000"
allowed_origins = os.getenv("ALLOWED_ORIGINS", default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(admin_lookup.router)
app.include_router(admin_questions.router)
app.include_router(admin_users.router)
app.include_router(admin_overview.router)
app.include_router(courses.router)
app.include_router(uploads.router)
app.include_router(questions.router)
app.include_router(answers.router)

@app.get("/")
def root():
    return {"status": "SparkL API running"}