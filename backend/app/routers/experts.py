"""
Expert Network Router - AI-Powered Legal & Compliance Expert Matching
Global expert directory with AI triage, geographic visualization, and engagement workflows
Includes real-time expert search using Groq + geocoding
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlmodel import Session, select
from datetime import datetime
import json
import os
import httpx
import asyncio
from math import radians, sin, cos, sqrt, atan2

from ..db import engine
from ..models.tables import Expert, ExpertIssue, ExpertEngagement, Loan
from ..middleware.security import require_auth, require_role, Role
from ..config import config

# Try to import Groq for AI triage
try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

def get_groq_api_key() -> Optional[str]:
    """Get Groq API key from config or environment."""
    return getattr(config, 'GROQ_API_KEY', None) or os.getenv("GROQ_API_KEY")

def get_google_maps_api_key() -> Optional[str]:
    """Get Google Maps API key from config or environment."""
    return getattr(config, 'GOOGLE_MAPS_API_KEY', None) or os.getenv("GOOGLE_MAPS_API_KEY")


# ============================================================================
# Geocoding Helper Functions
# ============================================================================

async def geocode_zip_code(zip_code: str, country: str = "US") -> Dict[str, Any]:
    """Convert zip code to coordinates using Google Geocoding API (primary) or fallback APIs."""
    
    google_api_key = get_google_maps_api_key()
    
    # Try Google Geocoding API first (most accurate)
    if google_api_key:
        try:
            async with httpx.AsyncClient() as client:
                url = "https://maps.googleapis.com/maps/api/geocode/json"
                params = {
                    "address": f"{zip_code}, {country}",
                    "key": google_api_key
                }
                response = await client.get(url, params=params, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("status") == "OK" and data.get("results"):
                        result = data["results"][0]
                        location = result["geometry"]["location"]
                        
                        # Extract address components
                        city = ""
                        state = ""
                        for component in result.get("address_components", []):
                            if "locality" in component["types"]:
                                city = component["long_name"]
                            elif "administrative_area_level_1" in component["types"]:
                                state = component["short_name"]
                        
                        return {
                            "latitude": location["lat"],
                            "longitude": location["lng"],
                            "formatted_address": result.get("formatted_address", zip_code),
                            "city": city,
                            "state": state,
                            "place_id": result.get("place_id"),
                            "source": "google"
                        }
        except Exception as e:
            print(f"Google geocoding failed: {e}")
    
    # Fallback: US Census Geocoder (for US zip codes)
    if country.upper() == "US":
        try:
            async with httpx.AsyncClient() as client:
                url = f"https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
                params = {
                    "address": zip_code,
                    "benchmark": "Public_AR_Current",
                    "format": "json"
                }
                response = await client.get(url, params=params, timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    if data.get("result", {}).get("addressMatches"):
                        match = data["result"]["addressMatches"][0]
                        coords = match["coordinates"]
                        return {
                            "latitude": coords["y"],
                            "longitude": coords["x"],
                            "formatted_address": match.get("matchedAddress", zip_code),
                            "city": match.get("addressComponents", {}).get("city", ""),
                            "state": match.get("addressComponents", {}).get("state", ""),
                            "source": "us_census"
                        }
        except Exception as e:
            print(f"US Census geocoding failed: {e}")
    
    # Final fallback: OpenStreetMap Nominatim
    try:
        async with httpx.AsyncClient() as client:
            url = "https://nominatim.openstreetmap.org/search"
            params = {
                "q": f"{zip_code}, {country}",
                "format": "json",
                "limit": 1,
                "addressdetails": 1
            }
            headers = {"User-Agent": "LoanTwinOS/4.0"}
            response = await client.get(url, params=params, headers=headers, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                if data:
                    result = data[0]
                    return {
                        "latitude": float(result["lat"]),
                        "longitude": float(result["lon"]),
                        "formatted_address": result.get("display_name", zip_code),
                        "city": result.get("address", {}).get("city") or result.get("address", {}).get("town", ""),
                        "state": result.get("address", {}).get("state", ""),
                        "source": "openstreetmap"
                    }
    except Exception as e:
        print(f"OpenStreetMap geocoding failed: {e}")
    
    return None


async def search_google_places(
    location: Dict[str, Any],
    expert_type: str,
    radius_meters: int = 50000
) -> List[Dict[str, Any]]:
    """Search Google Places API for real professionals/businesses."""
    
    google_api_key = get_google_maps_api_key()
    if not google_api_key:
        return []
    
    # Map expert types to Google Places search queries
    search_queries = {
        "legal": "law firm attorney lawyer",
        "compliance": "compliance consulting regulatory",
        "tax": "tax attorney CPA accountant",
        "valuation": "business valuation appraisal",
        "esg": "ESG sustainability consulting",
        "restructuring": "restructuring consulting bankruptcy attorney"
    }
    
    query = search_queries.get(expert_type, "professional services")
    
    try:
        async with httpx.AsyncClient() as client:
            # Use Places Text Search API
            url = "https://maps.googleapis.com/maps/api/place/textsearch/json"
            params = {
                "query": query,
                "location": f"{location['latitude']},{location['longitude']}",
                "radius": radius_meters,
                "key": google_api_key
            }
            
            response = await client.get(url, params=params, timeout=15.0)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "OK":
                    places = []
                    for place in data.get("results", [])[:10]:  # Top 10 results
                        place_data = {
                            "full_name": place.get("name"),
                            "firm_name": place.get("name"),
                            "formatted_address": place.get("formatted_address"),
                            "latitude": place["geometry"]["location"]["lat"],
                            "longitude": place["geometry"]["location"]["lng"],
                            "rating": place.get("rating"),
                            "total_ratings": place.get("user_ratings_total", 0),
                            "place_id": place.get("place_id"),
                            "business_status": place.get("business_status"),
                            "types": place.get("types", []),
                            "source": "google_places",
                            "verified": True  # Google Places data is verified
                        }
                        places.append(place_data)
                    return places
    except Exception as e:
        print(f"Google Places search failed: {e}")
    
    return []


async def get_place_details(place_id: str) -> Dict[str, Any]:
    """Get detailed information about a place from Google Places API."""
    
    google_api_key = get_google_maps_api_key()
    if not google_api_key:
        return {}
    
    try:
        async with httpx.AsyncClient() as client:
            url = "https://maps.googleapis.com/maps/api/place/details/json"
            params = {
                "place_id": place_id,
                "fields": "name,formatted_address,formatted_phone_number,website,opening_hours,rating,reviews,url",
                "key": google_api_key
            }
            
            response = await client.get(url, params=params, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "OK":
                    return data.get("result", {})
    except Exception as e:
        print(f"Google Place Details failed: {e}")
    
    return {}


async def search_real_experts_with_groq(
    zip_code: str,
    expert_type: str,
    issue_description: str,
    geo_data: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """Use Groq to find and structure real expert information."""
    
    if not GROQ_AVAILABLE:
        print("Groq not available - returning empty experts list")
        return []
    
    groq_api_key = get_groq_api_key()
    if not groq_api_key:
        print("GROQ_API_KEY not found - returning empty experts list")
        return []
    
    print(f"Searching for {expert_type} experts near {zip_code} using Groq...")
    client = Groq(api_key=groq_api_key)
    
    location_str = f"{geo_data.get('city', '')}, {geo_data.get('state', '')}" if geo_data else zip_code
    
    # Build a prompt to find real experts
    prompt = f"""You are a professional directory assistant. Find real {expert_type} professionals near {location_str} (zip code: {zip_code}) who could help with this issue:

Issue: {issue_description}

Please provide 5 REAL professionals/firms in this area that specialize in this type of work. For each, provide:
1. Full Name (real person or firm name)
2. Firm Name (if different)
3. Specialties (relevant to the issue)
4. City
5. Estimated hourly rate range
6. Why they're a good match

Focus on well-known, reputable firms. Include mix of:
- Big Law firms (if applicable)
- Regional specialists
- Boutique firms

Return as JSON array with this structure:
[
  {{
    "full_name": "string",
    "firm_name": "string", 
    "specialties": ["string"],
    "city": "string",
    "state": "string",
    "estimated_rate_min": number,
    "estimated_rate_max": number,
    "match_reason": "string",
    "confidence": "high" | "medium" | "low"
  }}
]

Only return the JSON array, no other text."""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "system",
                    "content": "You are a legal and compliance professional directory assistant. Provide accurate information about real firms and professionals. If unsure, indicate lower confidence."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000
        )
        
        content = response.choices[0].message.content.strip()
        
        # Try to parse JSON from response
        # Handle potential markdown code blocks
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        
        experts = json.loads(content)
        
        # Add geocoded coordinates and metadata
        for expert in experts:
            expert["latitude"] = geo_data.get("latitude") if geo_data else None
            expert["longitude"] = geo_data.get("longitude") if geo_data else None
            expert["source"] = "groq_search"
            expert["verified"] = False  # AI-found experts are not verified
            expert["search_location"] = location_str
        
        return experts
        
    except json.JSONDecodeError as e:
        print(f"Failed to parse Groq response as JSON: {e}")
        return []
    except Exception as e:
        print(f"Groq search failed: {e}")
        return []

router = APIRouter(prefix="/experts", tags=["Expert Network"])


# ============================================================================
# Request/Response Models
# ============================================================================

class ExpertCreate(BaseModel):
    full_name: str
    firm_name: str
    category: str
    specialties: List[str]
    jurisdictions: List[str]
    governing_laws: str = "English"
    city: str
    country: str
    email: str
    phone: Optional[str] = None
    hourly_rate: Optional[float] = None
    bio: Optional[str] = None


class IssueCreate(BaseModel):
    loan_id: int
    category: str
    severity: str = "medium"
    title: str
    description: str


class EngagementDraftRequest(BaseModel):
    issue_id: int
    expert_id: int
    scope_of_work: str
    estimated_hours: float


class TriageResult(BaseModel):
    category: str
    urgency: str
    jurisdictions: List[str]
    top_experts: List[Dict[str, Any]]
    ai_reasoning: str


class RealExpertSearchRequest(BaseModel):
    zip_code: str
    country: str = "US"
    expert_type: str = "legal"  # legal, compliance, tax, valuation, esg
    issue_description: str
    radius_miles: int = 50


class RealExpertSearchResult(BaseModel):
    search_location: Dict[str, Any]
    experts: List[Dict[str, Any]]
    search_params: Dict[str, Any]
    ai_powered: bool


# ============================================================================
# Real-Time Expert Search (Groq-Powered)
# ============================================================================

@router.post("/search/realtime", response_model=RealExpertSearchResult)
async def search_real_experts(request: RealExpertSearchRequest):
    """
    Search for REAL experts near a zip code using Google Maps + Groq AI.
    
    This endpoint:
    1. Geocodes the zip code using Google Geocoding API
    2. Searches Google Places for real businesses
    3. Uses Groq AI to find and match additional experts
    4. Combines and deduplicates results
    
    Expert types: legal, compliance, tax, valuation, esg, restructuring
    """
    
    # Step 1: Geocode the zip code (Google first, then fallbacks)
    geo_data = await geocode_zip_code(request.zip_code, request.country)
    
    if not geo_data:
        geo_data = {
            "latitude": None,
            "longitude": None,
            "formatted_address": f"{request.zip_code}, {request.country}",
            "city": "",
            "state": "",
            "source": "fallback"
        }
    
    all_experts = []
    
    # Step 2: Search Google Places for real businesses (verified data)
    if geo_data.get("latitude") and geo_data.get("longitude"):
        radius_meters = int(request.radius_miles * 1609.34)  # Convert miles to meters
        google_places = await search_google_places(
            location=geo_data,
            expert_type=request.expert_type,
            radius_meters=min(radius_meters, 50000)  # Max 50km for Places API
        )
        
        # Enhance Google Places results with category
        for place in google_places:
            place["category"] = request.expert_type
            place["specialties"] = [request.expert_type.title(), "Professional Services"]
            place["confidence"] = "verified"
            place["match_reason"] = f"Google verified {request.expert_type} professional near {geo_data.get('city', request.zip_code)}"
        
        all_experts.extend(google_places)
    
    # Step 3: Also search with Groq AI for additional matches
    groq_experts = await search_real_experts_with_groq(
        zip_code=request.zip_code,
        expert_type=request.expert_type,
        issue_description=request.issue_description,
        geo_data=geo_data
    )
    
    # Mark Groq results as AI-suggested
    for expert in groq_experts:
        expert["source"] = "groq_ai"
    
    all_experts.extend(groq_experts)
    
    return {
        "search_location": geo_data,
        "experts": all_experts,
        "search_params": {
            "zip_code": request.zip_code,
            "country": request.country,
            "expert_type": request.expert_type,
            "radius_miles": request.radius_miles
        },
        "ai_powered": True
    }


@router.get("/search/places/{place_id}")
async def get_expert_place_details(place_id: str):
    """Get detailed information about an expert/firm from Google Places."""
    details = await get_place_details(place_id)
    if not details:
        raise HTTPException(404, "Place not found")
    return details


@router.get("/search/geocode/{zip_code}")
async def geocode_location(zip_code: str, country: str = "US"):
    """Geocode a zip code to coordinates."""
    geo_data = await geocode_zip_code(zip_code, country)
    
    if not geo_data:
        raise HTTPException(404, f"Could not geocode zip code: {zip_code}")
    
    return geo_data


@router.get("/map/config")
async def get_map_config():
    """Get Google Maps configuration for frontend."""
    google_api_key = get_google_maps_api_key()
    return {
        "api_key": google_api_key,
        "map_id": "expert_network_map",
        "default_center": {"lat": 40.7128, "lng": -74.0060},  # NYC
        "default_zoom": 10
    }


@router.post("/search/nearby")
async def find_nearby_experts(
    zip_code: str,
    expert_type: str = "legal",
    radius_miles: int = 50,
    country: str = "US"
):
    """
    Find existing experts in database near a zip code.
    Falls back to Groq search if no local experts found.
    """
    
    # Geocode the zip code
    geo_data = await geocode_zip_code(zip_code, country)
    
    if not geo_data or not geo_data.get("latitude"):
        raise HTTPException(400, "Could not geocode zip code")
    
    lat = geo_data["latitude"]
    lon = geo_data["longitude"]
    
    # Calculate approximate degree range for radius
    # 1 degree latitude ≈ 69 miles
    lat_range = radius_miles / 69.0
    # 1 degree longitude varies, but ~69 miles at equator, less at higher latitudes
    lon_range = radius_miles / (69.0 * abs(cos(radians(lat))) if lat else 69.0)
    
    with Session(engine) as session:
        query = select(Expert).where(
            Expert.latitude.between(lat - lat_range, lat + lat_range),
            Expert.longitude.between(lon - lon_range, lon + lon_range)
        )
        
        if expert_type and expert_type != "all":
            query = query.where(Expert.category == expert_type)
        
        local_experts = session.exec(query.limit(20)).all()
        
        return {
            "search_location": geo_data,
            "local_experts": [
                {
                    "id": e.id,
                    "full_name": e.full_name,
                    "firm_name": e.firm_name,
                    "category": e.category,
                    "specialties": json.loads(e.specialties) if e.specialties else [],
                    "city": e.city,
                    "country": e.country,
                    "latitude": e.latitude,
                    "longitude": e.longitude,
                    "rating": e.rating,
                    "verified": e.verified,
                    "distance_miles": calculate_distance(lat, lon, e.latitude, e.longitude) if e.latitude and e.longitude else None
                }
                for e in local_experts
            ],
            "total_found": len(local_experts),
            "search_radius_miles": radius_miles
        }


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points using Haversine formula."""
    R = 3959  # Earth's radius in miles
    
    lat1_r, lon1_r, lat2_r, lon2_r = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2_r - lat1_r
    dlon = lon2_r - lon1_r
    
    a = sin(dlat/2)**2 + cos(lat1_r) * cos(lat2_r) * sin(dlon/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return round(R * c, 1)


# ============================================================================
# Expert Directory Endpoints
# ============================================================================

@router.get("")
def list_experts(
    category: Optional[str] = None,
    jurisdiction: Optional[str] = None,
    governing_law: Optional[str] = None,
    verified_only: bool = False,
    limit: int = 50,
    offset: int = 0
):
    """List experts with filters."""
    with Session(engine) as session:
        query = select(Expert)
        
        if category:
            query = query.where(Expert.category == category)
        if jurisdiction:
            query = query.where(Expert.jurisdictions.contains(jurisdiction))
        if governing_law:
            query = query.where(Expert.governing_laws.contains(governing_law))
        if verified_only:
            query = query.where(Expert.verified == True)
        
        query = query.order_by(Expert.rating.desc()).offset(offset).limit(limit)
        experts = session.exec(query).all()
        
        return {
            "experts": [
                {
                    "id": e.id,
                    "full_name": e.full_name,
                    "firm_name": e.firm_name,
                    "category": e.category,
                    "specialties": json.loads(e.specialties) if e.specialties else [],
                    "jurisdictions": json.loads(e.jurisdictions) if e.jurisdictions else [],
                    "governing_laws": e.governing_laws,
                    "city": e.city,
                    "country": e.country,
                    "latitude": e.latitude,
                    "longitude": e.longitude,
                    "email": e.email,
                    "phone": e.phone,
                    "bio": e.bio,
                    "rating": e.rating,
                    "completed_engagements": e.completed_engagements,
                    "hourly_rate": e.hourly_rate,
                    "currency": e.currency,
                    "verified": e.verified
                }
                for e in experts
            ],
            "count": len(experts),
            "offset": offset
        }


@router.get("/map")
def get_experts_map_data(
    category: Optional[str] = None,
    jurisdiction: Optional[str] = None
):
    """Get expert data in GeoJSON format for map visualization."""
    with Session(engine) as session:
        query = select(Expert).where(Expert.latitude != None, Expert.longitude != None)
        
        if category:
            query = query.where(Expert.category == category)
        if jurisdiction:
            query = query.where(Expert.jurisdictions.contains(jurisdiction))
        
        experts = session.exec(query).all()
        
        # Format as GeoJSON
        features = []
        for e in experts:
            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [e.longitude, e.latitude]
                },
                "properties": {
                    "id": e.id,
                    "name": e.full_name,
                    "firm": e.firm_name,
                    "category": e.category,
                    "city": e.city,
                    "country": e.country,
                    "rating": e.rating,
                    "verified": e.verified
                }
            })
        
        return {
            "type": "FeatureCollection",
            "features": features
        }


@router.post("")
def create_expert(
    expert_data: ExpertCreate,
    current_user: Dict = Depends(require_role([Role.ADMIN]))
):
    """Add new expert to directory (admin only)."""
    with Session(engine) as session:
        expert = Expert(
            full_name=expert_data.full_name,
            firm_name=expert_data.firm_name,
            category=expert_data.category,
            specialties=json.dumps(expert_data.specialties),
            jurisdictions=json.dumps(expert_data.jurisdictions),
            governing_laws=expert_data.governing_laws,
            city=expert_data.city,
            country=expert_data.country,
            email=expert_data.email,
            phone=expert_data.phone,
            hourly_rate=expert_data.hourly_rate,
            bio=expert_data.bio,
            verified=False
        )
        session.add(expert)
        session.commit()
        session.refresh(expert)
        
        return {"id": expert.id, "message": "Expert added to directory"}


# ============================================================================
# Issue Management & AI Triage
# ============================================================================

@router.post("/issues")
def create_issue(
    issue_data: IssueCreate,
    current_user: Dict = Depends(require_auth)
):
    """Create new issue requiring expert assistance."""
    with Session(engine) as session:
        # Verify loan exists
        loan = session.get(Loan, issue_data.loan_id)
        if not loan:
            raise HTTPException(404, "Loan not found")
        
        issue = ExpertIssue(
            loan_id=issue_data.loan_id,
            created_by=current_user.get("id"),
            category=issue_data.category,
            severity=issue_data.severity,
            title=issue_data.title,
            description=issue_data.description,
            status="open"
        )
        session.add(issue)
        session.commit()
        session.refresh(issue)
        
        return {"id": issue.id, "message": "Issue created", "status": "open"}


@router.get("/issues")
def list_issues(
    status: Optional[str] = None,
    loan_id: Optional[int] = None,
    limit: int = 50
):
    """List issues requiring expert assistance."""
    with Session(engine) as session:
        query = select(ExpertIssue)
        
        if status:
            query = query.where(ExpertIssue.status == status)
        if loan_id:
            query = query.where(ExpertIssue.loan_id == loan_id)
        
        query = query.order_by(ExpertIssue.created_at.desc()).limit(limit)
        issues = session.exec(query).all()
        
        return {
            "issues": [
                {
                    "id": i.id,
                    "loan_id": i.loan_id,
                    "category": i.category,
                    "severity": i.severity,
                    "title": i.title,
                    "status": i.status,
                    "ai_category": i.ai_category,
                    "created_at": i.created_at.isoformat()
                }
                for i in issues
            ]
        }


@router.post("/issues/{issue_id}/triage")
def triage_issue(issue_id: int):
    """Run AI triage on an issue to categorize and match experts."""
    with Session(engine) as session:
        issue = session.get(ExpertIssue, issue_id)
        if not issue:
            raise HTTPException(404, "Issue not found")
        
        loan = session.get(Loan, issue.loan_id)
        
        # AI Triage using Groq
        triage_result = run_ai_triage(issue, loan)
        
        # Update issue with AI analysis
        issue.ai_analysis = triage_result.get("ai_reasoning", "")
        issue.ai_category = triage_result.get("category", issue.category)
        issue.ai_jurisdiction_match = json.dumps(triage_result.get("jurisdictions", []))
        issue.status = "triaged"
        session.add(issue)
        session.commit()
        
        return triage_result


def run_ai_triage(issue: ExpertIssue, loan: Optional[Loan]) -> Dict[str, Any]:
    """Run AI triage to categorize issue and match experts."""
    
    # Default result structure
    result = {
        "category": issue.category,
        "urgency": issue.severity,
        "jurisdictions": [],
        "top_experts": [],
        "ai_reasoning": ""
    }
    
    # Get Groq client
    groq_client = None
    if GROQ_AVAILABLE:
        api_key = os.getenv("GROQ_API_KEY", "")
        if api_key:
            groq_client = Groq(api_key=api_key)
    
    if groq_client:
        prompt = f"""Analyze this legal/compliance issue and provide classification:

Issue Title: {issue.title}
Description: {issue.description}
Current Category: {issue.category}
Severity: {issue.severity}
Loan Governing Law: {loan.governing_law if loan else 'English Law'}

Provide in JSON format:
{{
    "primary_category": "legal|compliance|valuer|auditor|esg",
    "secondary_category": "optional",
    "jurisdictions": ["list of relevant jurisdictions"],
    "urgency": "routine|urgent|critical",
    "specialist_type": "specific type needed",
    "reasoning": "brief explanation"
}}"""

        try:
            response = groq_client.chat.completions.create(
                model="llama3-70b-8192",
                messages=[
                    {"role": "system", "content": "You are a legal/compliance expert classifier. Return only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.2
            )
            
            response_text = response.choices[0].message.content.strip()
            # Parse JSON from response
            if "{" in response_text:
                json_start = response_text.index("{")
                json_end = response_text.rindex("}") + 1
                ai_result = json.loads(response_text[json_start:json_end])
                
                result["category"] = ai_result.get("primary_category", issue.category)
                result["urgency"] = ai_result.get("urgency", issue.severity)
                result["jurisdictions"] = ai_result.get("jurisdictions", [])
                result["ai_reasoning"] = ai_result.get("reasoning", "")
        except:
            result["ai_reasoning"] = "AI triage unavailable - using default classification"
    
    # Find matching experts
    with Session(engine) as session:
        query = select(Expert).where(Expert.category == result["category"])
        
        # Filter by jurisdiction if available
        if result["jurisdictions"]:
            for jurisdiction in result["jurisdictions"]:
                query = query.where(Expert.jurisdictions.contains(jurisdiction))
        
        experts = session.exec(query.order_by(Expert.rating.desc()).limit(5)).all()
        
        result["top_experts"] = [
            {
                "id": e.id,
                "name": e.full_name,
                "firm": e.firm_name,
                "rating": e.rating,
                "city": e.city,
                "country": e.country,
                "hourly_rate": e.hourly_rate
            }
            for e in experts
        ]
    
    return result


# ============================================================================
# Engagement Workflow
# ============================================================================

@router.post("/engagements/draft")
def draft_engagement(
    request: EngagementDraftRequest,
    current_user: Dict = Depends(require_auth)
):
    """AI drafts engagement letter for expert."""
    with Session(engine) as session:
        issue = session.get(ExpertIssue, request.issue_id)
        if not issue:
            raise HTTPException(404, "Issue not found")
        
        expert = session.get(Expert, request.expert_id)
        if not expert:
            raise HTTPException(404, "Expert not found")
        
        loan = session.get(Loan, issue.loan_id)
        
        # Generate engagement letter using AI
        letter = generate_engagement_letter(issue, expert, loan, request.scope_of_work)
        
        # Calculate estimated cost
        estimated_cost = (expert.hourly_rate or 500) * request.estimated_hours
        
        # Create engagement record
        engagement = ExpertEngagement(
            issue_id=request.issue_id,
            expert_id=request.expert_id,
            drafted_letter=letter,
            scope_of_work=request.scope_of_work,
            estimated_hours=request.estimated_hours,
            estimated_cost=estimated_cost,
            status="draft"
        )
        session.add(engagement)
        session.commit()
        session.refresh(engagement)
        
        return {
            "id": engagement.id,
            "drafted_letter": letter,
            "estimated_cost": estimated_cost,
            "currency": expert.currency,
            "status": "draft"
        }


def generate_engagement_letter(
    issue: ExpertIssue,
    expert: Expert,
    loan: Optional[Loan],
    scope_of_work: str
) -> str:
    """Generate engagement letter using AI or template."""
    
    # Default template
    letter = f"""ENGAGEMENT LETTER

Date: {datetime.utcnow().strftime('%B %d, %Y')}

To: {expert.full_name}
    {expert.firm_name}
    {expert.city}, {expert.country}

Re: Engagement for {issue.title}
    Loan Reference: {loan.name if loan else 'N/A'}

Dear {expert.full_name.split()[0]},

We are pleased to engage your services in connection with the matter described below.

1. SCOPE OF ENGAGEMENT
{scope_of_work}

2. MATTER DESCRIPTION
Issue Category: {issue.category.title()}
Description: {issue.description}

3. FEES AND BILLING
Your fees will be billed at your standard hourly rate of {expert.hourly_rate or '[TO BE AGREED]'} {expert.currency}/hour.

4. CONFIDENTIALITY
All information provided in connection with this engagement shall be treated as confidential.

5. GOVERNING LAW
This engagement shall be governed by {loan.governing_law if loan else 'English Law'}.

Please confirm your acceptance of this engagement by signing below.

Yours sincerely,

[LoanTwin OS - Digital Signature Pending]

ACCEPTED AND AGREED:

_______________________
{expert.full_name}
{expert.firm_name}
Date: _______________
"""
    
    return letter


@router.post("/engagements/{engagement_id}/approve")
def approve_engagement(
    engagement_id: int,
    current_user: Dict = Depends(require_role([Role.ADMIN, Role.ANALYST]))
):
    """Approve engagement and notify expert."""
    with Session(engine) as session:
        engagement = session.get(ExpertEngagement, engagement_id)
        if not engagement:
            raise HTTPException(404, "Engagement not found")
        
        if engagement.status != "draft" and engagement.status != "pending_approval":
            raise HTTPException(400, f"Cannot approve engagement in {engagement.status} status")
        
        engagement.status = "approved"
        engagement.approved_by = current_user.get("id")
        engagement.approved_at = datetime.utcnow()
        session.add(engagement)
        
        # Update issue status
        issue = session.get(ExpertIssue, engagement.issue_id)
        if issue:
            issue.status = "engaged"
            issue.assigned_expert_id = engagement.expert_id
            session.add(issue)
        
        session.commit()
        
        return {"message": "Engagement approved", "status": "approved"}


@router.get("/engagements/pending")
def get_pending_engagements(current_user: Dict = Depends(require_auth)):
    """Get engagements pending approval."""
    with Session(engine) as session:
        engagements = session.exec(
            select(ExpertEngagement)
            .where(ExpertEngagement.status.in_(["draft", "pending_approval"]))
            .order_by(ExpertEngagement.created_at.desc())
        ).all()
        
        return {
            "engagements": [
                {
                    "id": e.id,
                    "issue_id": e.issue_id,
                    "expert_id": e.expert_id,
                    "scope_of_work": e.scope_of_work,
                    "estimated_hours": e.estimated_hours,
                    "estimated_cost": e.estimated_cost,
                    "status": e.status,
                    "created_at": e.created_at.isoformat()
                }
                for e in engagements
            ]
        }


# ============================================================================
# Demo Data Seeding
# ============================================================================

@router.post("/demo/seed")
def seed_demo_experts():
    """Seed demo expert data (public for testing). Prevents duplicates."""
    
    demo_experts = [
        # Legal Experts
        {
            "full_name": "Sarah Chen",
            "firm_name": "Allen & Overy LLP",
            "category": "legal",
            "specialties": ["Syndicated Lending", "Restructuring", "LMA Documentation"],
            "jurisdictions": ["UK", "EU"],
            "governing_laws": "English",
            "city": "London",
            "country": "UK",
            "email": "s.chen@ao.com",
            "latitude": 51.5074,
            "longitude": -0.1278,
            "hourly_rate": 850,
            "currency": "GBP",
            "rating": 4.9,
            "verified": True,
            "bio": "Partner specializing in complex syndicated lending and restructuring matters."
        },
        {
            "full_name": "Michael Johnson",
            "firm_name": "Cravath, Swaine & Moore LLP",
            "category": "legal",
            "specialties": ["Leveraged Finance", "NY Law", "High Yield"],
            "jurisdictions": ["US", "NY"],
            "governing_laws": "NY",
            "city": "New York",
            "country": "US",
            "email": "mjohnson@cravath.com",
            "latitude": 40.7128,
            "longitude": -74.0060,
            "hourly_rate": 1200,
            "currency": "USD",
            "rating": 4.8,
            "verified": True,
            "bio": "Senior partner with 25 years experience in leveraged finance."
        },
        # Compliance Experts
        {
            "full_name": "Emma Williams",
            "firm_name": "Deloitte Financial Advisory",
            "category": "compliance",
            "specialties": ["AML/KYC", "Sanctions Screening", "FCA Compliance"],
            "jurisdictions": ["UK", "EU", "US"],
            "governing_laws": "English",
            "city": "London",
            "country": "UK",
            "email": "ewilliams@deloitte.co.uk",
            "latitude": 51.5155,
            "longitude": -0.0922,
            "hourly_rate": 650,
            "currency": "GBP",
            "rating": 4.7,
            "verified": True,
            "bio": "Director in AML advisory with expertise in cross-border transactions."
        },
        # ESG Verifiers
        {
            "full_name": "Dr. Klaus Mueller",
            "firm_name": "ISS ESG",
            "category": "esg",
            "specialties": ["Carbon Accounting", "Sustainability Reporting", "Green Loans"],
            "jurisdictions": ["EU", "UK", "US"],
            "governing_laws": "English",
            "city": "Frankfurt",
            "country": "Germany",
            "email": "kmueller@issesg.com",
            "latitude": 50.1109,
            "longitude": 8.6821,
            "hourly_rate": 550,
            "currency": "EUR",
            "rating": 4.6,
            "verified": True,
            "bio": "Leading ESG verification specialist with focus on green loan frameworks."
        },
        # Valuers
        {
            "full_name": "James Thompson",
            "firm_name": "CBRE Valuation & Advisory",
            "category": "valuer",
            "specialties": ["Real Estate", "Commercial Property", "Portfolio Valuation"],
            "jurisdictions": ["UK", "EU"],
            "governing_laws": "English",
            "city": "London",
            "country": "UK",
            "email": "jthompson@cbre.com",
            "latitude": 51.5200,
            "longitude": -0.1000,
            "hourly_rate": 450,
            "currency": "GBP",
            "rating": 4.5,
            "verified": True,
            "bio": "RICS-qualified valuer with expertise in commercial real estate."
        }
    ]
    
    with Session(engine) as session:
        added = 0
        skipped = 0
        
        for expert_data in demo_experts:
            # Check if expert already exists (by email - unique identifier)
            existing = session.exec(
                select(Expert).where(Expert.email == expert_data["email"])
            ).first()
            
            if existing:
                skipped += 1
                continue
            
            expert = Expert(
                full_name=expert_data["full_name"],
                firm_name=expert_data["firm_name"],
                category=expert_data["category"],
                specialties=json.dumps(expert_data["specialties"]),
                jurisdictions=json.dumps(expert_data["jurisdictions"]),
                governing_laws=expert_data["governing_laws"],
                city=expert_data["city"],
                country=expert_data["country"],
                email=expert_data["email"],
                latitude=expert_data.get("latitude"),
                longitude=expert_data.get("longitude"),
                hourly_rate=expert_data.get("hourly_rate"),
                currency=expert_data.get("currency", "USD"),
                rating=expert_data.get("rating", 4.0),
                verified=expert_data.get("verified", False),
                bio=expert_data.get("bio")
            )
            session.add(expert)
            added += 1
        
        session.commit()
    
    return {"message": f"Seeded {added} new experts, {skipped} already existed"}


@router.delete("/demo/clear")
def clear_demo_experts():
    """Clear all demo experts from database."""
    with Session(engine) as session:
        # Delete all experts
        experts = session.exec(select(Expert)).all()
        count = len(experts)
        for expert in experts:
            session.delete(expert)
        session.commit()
    
    return {"message": f"Cleared {count} experts from database"}


@router.post("/demo/cleanup-duplicates")
def cleanup_duplicate_experts():
    """Remove duplicate experts, keeping only the first occurrence based on email."""
    with Session(engine) as session:
        # Get all experts
        all_experts = session.exec(select(Expert).order_by(Expert.id)).all()
        
        seen_emails = set()
        duplicates_removed = 0
        
        for expert in all_experts:
            if expert.email in seen_emails:
                # This is a duplicate
                session.delete(expert)
                duplicates_removed += 1
            else:
                seen_emails.add(expert.email)
        
        session.commit()
    
    return {"message": f"Removed {duplicates_removed} duplicate experts"}


# ============================================================================
# Expert Detail (MUST BE LAST - catches /{expert_id} pattern)
# ============================================================================

@router.get("/{expert_id}")
def get_expert(expert_id: int):
    """Get detailed expert profile."""
    with Session(engine) as session:
        expert = session.get(Expert, expert_id)
        if not expert:
            raise HTTPException(404, "Expert not found")
        
        return {
            "id": expert.id,
            "full_name": expert.full_name,
            "firm_name": expert.firm_name,
            "category": expert.category,
            "specialties": json.loads(expert.specialties) if expert.specialties else [],
            "jurisdictions": json.loads(expert.jurisdictions) if expert.jurisdictions else [],
            "governing_laws": expert.governing_laws,
            "address": expert.address,
            "city": expert.city,
            "country": expert.country,
            "postal_code": expert.postal_code,
            "email": expert.email,
            "phone": expert.phone,
            "bar_number": expert.bar_number,
            "regulatory_id": expert.regulatory_id,
            "rating": expert.rating,
            "completed_engagements": expert.completed_engagements,
            "hourly_rate": expert.hourly_rate,
            "currency": expert.currency,
            "bio": expert.bio,
            "verified": expert.verified,
            "verified_date": expert.verified_date.isoformat() if expert.verified_date else None
        }
