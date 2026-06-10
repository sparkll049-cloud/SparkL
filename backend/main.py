from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"status": "SparkL Backend is working on my phone!"}
