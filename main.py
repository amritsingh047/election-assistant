import logging
import sys
import os
from dotenv import load_dotenv

# Configure basic logging immediately to catch startup errors in Cloud Run logs
print("DEBUG: main.py is being loaded...")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger_startup = logging.getLogger("startup")
logger_startup.info("DEBUG: logging initialized.")

from fastapi import FastAPI, Request, Response
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from typing import Dict, Any

# Robust imports from package structure
from backend.routes import assistant_router, analytics_router, auth_router
from services.logger import setup_cloud_logger

# Initialize Structured Cloud Logger
logger = setup_cloud_logger(__name__)

# Load environment variables
load_dotenv()

# Rate limiting
limiter: Limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Smart Election Assistant",
    description="An enterprise-grade AI assistant for election process, timelines, and analytics.",
    version="1.1.0",
    contact={
        "name": "Smart Election Assistant Team",
    }
)

@app.on_event("startup")
async def startup_event():
    logger.info("Smart Election Assistant Application starting up.")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(assistant_router, prefix="/api/assistant", tags=["Assistant"])
app.include_router(analytics_router, prefix="/api", tags=["Analytics"])

# Security Middleware (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Efficiency Middleware (GZip)
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Adds strict security headers to every response."""
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global error handler to prevent generic 500 errors and log the root cause."""
    logger.error(f"Global Exception caught: {str(exc)}", extra={"extra_args": {"path": request.url.path}})
    return Response(
        content=f"Internal Server Error: {str(exc)}",
        status_code=500
    )

# Static files and Templates
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
templates = Jinja2Templates(directory="frontend/templates")

@app.get("/", response_class=HTMLResponse, summary="Main Entrypoint", description="Serves the main HTML application.")
@limiter.limit("20/minute")
async def read_root(request: Request) -> Response:
    return templates.TemplateResponse(request=request, name="index.html", context={})

@app.get("/api/health", summary="Health Check", description="Returns the health status of the API.")
@limiter.limit("60/minute")
async def health_check(request: Request) -> Dict[str, str]:
    return {"status": "healthy", "service": "election-assistant-api"}
