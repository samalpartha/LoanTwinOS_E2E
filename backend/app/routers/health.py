from fastapi import APIRouter
from ..config import config
import os

router = APIRouter()

@router.get("/health")
def health():
    return {"ok": True}

@router.get("/health/diagnostics")
def diagnostics():
    """Diagnostic endpoint to check external API availability."""
    # Check Groq
    groq_key = getattr(config, 'GROQ_API_KEY', None) or os.getenv("GROQ_API_KEY")
    
    # Check Eleven Labs
    eleven_labs_key = getattr(config, 'ELEVEN_LABS_API_KEY', None) or os.getenv("ELEVEN_LABS_API_KEY")
    
    # Check Google Maps
    google_maps_key = getattr(config, 'GOOGLE_MAPS_API_KEY', None) or os.getenv("GOOGLE_MAPS_API_KEY")
    
    return {
        "status": "online",
        "apis": {
            "groq": {
                "configured": bool(groq_key),
                "status": "available" if groq_key else "missing_key"
            },
            "eleven_labs": {
                "configured": bool(eleven_labs_key),
                "status": "available" if eleven_labs_key else "missing_key"
            },
            "google_maps": {
                "configured": bool(google_maps_key),
                "status": "available" if google_maps_key else "missing_key"
            }
        },
        "environment": os.getenv("K_SERVICE", "local") # Cloud Run service name or "local"
    }
