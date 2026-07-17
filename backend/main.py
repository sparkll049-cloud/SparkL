from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import (
    dashboard,
    admin_lookup,
    admin_questions,
    admin_users,
    admin_overview,
    courses,
)

app = FastAPI(title="SparkL API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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


@app.get("/")
def root():
    return {"status": "SparkL API running"}