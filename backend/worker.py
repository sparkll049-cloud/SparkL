import asyncio
from app.services.extraction_worker import run_extraction_worker

if __name__ == "__main__":
    asyncio.run(run_extraction_worker())