from fastapi import FastAPI

app = FastAPI(title="Human Clarity API")


@app.get("/")
async def root():
    return {
        "service": "human-clarity-python",
        "status": "ok",
        "message": "Python service is running.",
    }


@app.get("/health")
async def health():
    return {"ok": True}
