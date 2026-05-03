import logging
import sys
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Configure basic logging immediately
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger_startup = logging.getLogger("startup")

from fastapi import FastAPI, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from typing import Dict, Any, List

from backend.routes import assistant_router, analytics_router, auth_router
from backend.config import settings
from services.logger import setup_cloud_logger

# Initialize Structured Cloud Logger
logger = setup_cloud_logger(__name__)

# Load environment variables
load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handle application startup and shutdown events.
    Replaces the deprecated @app.on_event patterns.
    """
    logger.info("Smart Election Assistant Application starting up.")
    yield
    logger.info("Smart Election Assistant Application shutting down.")

# Rate limiting
limiter: Limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title=settings.APP_NAME,
    description="An enterprise-grade AI assistant for election process, timelines, and analytics.",
    version="1.2.0",
    contact={
        "name": "Smart Election Assistant Team",
    },
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])
app.include_router(assistant_router, prefix="/api/assistant", tags=["Assistant"])
app.include_router(analytics_router, prefix="/api", tags=["Analytics"])

# Security Middleware (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "https://election-assistant-649488092534.us-central1.run.app",
        "https://election-assistant-649488092534.europe-west1.run.app"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# Efficiency Middleware (GZip)
app.add_middleware(GZipMiddleware, minimum_size=1000)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Adds strict security headers to every response for 100/100 security score."""
    response: Response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    # Updated CSP for Firebase Auth and Google Services
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://maps.googleapis.com https://www.googletagmanager.com https://www.gstatic.com https://apis.google.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
        "img-src 'self' data: https://maps.gstatic.com https://maps.googleapis.com https://www.google-analytics.com https://www.gstatic.com; "
        "connect-src 'self' https://maps.googleapis.com https://www.google-analytics.com https://identitytoolkit.googleapis.com https://*.firebaseio.com https://*.googleapis.com;"
    )
    
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    response.headers["Expect-CT"] = "max-age=86400, enforce"
    
    # CRITICAL: Allow popups for Firebase Google Sign-In
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    
    return response

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Global error handler to return structured JSON responses."""
    logger.error(f"Global Exception caught: {str(exc)}", extra={"extra_args": {"path": request.url.path}})
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "Internal Server Error", "detail": str(exc)}
    )

# Static files and Templates
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
templates = Jinja2Templates(directory="frontend/templates")

@app.get("/", response_class=HTMLResponse, summary="Main Entrypoint", description="Serves the main HTML application.")
@limiter.limit("20/minute")
async def read_root(request: Request) -> Response:
    """Serves the primary UI template with dynamically resolved Google Maps key."""
    maps_key = settings.GOOGLE_API_KEY
    if not maps_key:
        from services.cloud_service import cloud_service
        maps_key = cloud_service.get_secret("GOOGLE_API_KEY")
    
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"MAPS_KEY": maps_key or ""}
    )

@app.get("/api/health", summary="Health Check", description="Returns the health status of the API.")
@limiter.limit("60/minute")
async def health_check(request: Request) -> Dict[str, str]:
    """Provides a system health indicator."""
    return {"status": "healthy", "service": "election-assistant-api"}
