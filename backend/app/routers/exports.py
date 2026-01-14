"""
LoanTwin Exports Router
Video briefings, deal roadshows, and export generation.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from pathlib import Path
import os
from ..services.video_gen import video_generator, VideoType, VideoJob, VIDEO_OUTPUT_DIR

router = APIRouter(prefix="/exports", tags=["exports"])


class VideoBriefingRequest(BaseModel):
    video_type: str  # daily_update, investor_teaser, risk_alert, etc.
    personalization: Dict[str, Any] = {}


class RoadshowRequest(BaseModel):
    recipients: List[str] = []
    template: str = "investor_teaser"
    personalization: Dict[str, Any] = {}


@router.post("/generate-briefing/{loan_id}")
def generate_video_briefing(loan_id: int, request: VideoBriefingRequest):
    """
    Generate a video briefing for a loan.
    Returns the completed job with script.
    """
    try:
        video_type = VideoType(request.video_type)
    except ValueError:
        raise HTTPException(400, f"Invalid video type. Valid types: {[t.value for t in VideoType]}")
    
    job = video_generator.create_video_job(
        loan_id=loan_id,
        video_type=video_type,
        personalization=request.personalization
    )
    
    # Return full job details including script
    return {
        "job_id": job.id,
        "status": job.status.value,
        "video_type": job.video_type.value,
        "created_at": job.created_at,
        "completed_at": job.completed_at,
        "script": job.script,
        "duration_seconds": job.duration_seconds,
        "video_url": job.video_url,
        "thumbnail_url": job.thumbnail_url,
        "error": job.error,
        "message": "Video briefing generated" if job.status.value == "completed" else f"Generation {job.status.value}"
    }


@router.get("/briefing-status/{job_id}")
def get_briefing_status(job_id: str):
    """
    Get the status of a video briefing job.
    """
    job = video_generator.get_job(job_id)
    if not job:
        raise HTTPException(404, "Video job not found")
    
    return {
        "job_id": job.id,
        "status": job.status.value,
        "video_type": job.video_type.value,
        "created_at": job.created_at,
        "completed_at": job.completed_at,
        "has_script": job.script is not None,
        "video_url": job.video_url,
        "thumbnail_url": job.thumbnail_url,
        "duration_seconds": job.duration_seconds,
        "error": job.error
    }


@router.get("/briefing/{job_id}")
def get_briefing(job_id: str):
    """
    Get the completed video briefing details including script.
    """
    job = video_generator.get_job(job_id)
    if not job:
        raise HTTPException(404, "Video job not found")
    
    if job.status.value != "completed":
        raise HTTPException(400, f"Video not ready. Current status: {job.status.value}")
    
    return {
        "job_id": job.id,
        "loan_id": job.loan_id,
        "video_type": job.video_type.value,
        "script": job.script,
        "video_url": job.video_url,
        "thumbnail_url": job.thumbnail_url,
        "duration_seconds": job.duration_seconds,
        "completed_at": job.completed_at
    }


@router.get("/briefings/{loan_id}")
def list_briefings(loan_id: int, limit: int = 20):
    """
    List all video briefings for a loan.
    """
    jobs = video_generator.list_jobs(loan_id)[:limit]
    
    return {
        "loan_id": loan_id,
        "count": len(jobs),
        "briefings": [
            {
                "job_id": j.id,
                "video_type": j.video_type.value,
                "status": j.status.value,
                "created_at": j.created_at,
                "completed_at": j.completed_at,
                "has_video": j.video_url is not None
            }
            for j in jobs
        ]
    }


@router.post("/generate-roadshow/{loan_id}")
def generate_deal_roadshow(loan_id: int, request: RoadshowRequest):
    """
    Generate a deal roadshow teaser video for marketing.
    Can be personalized for multiple recipients.
    """
    jobs = []
    
    # Generate one video per recipient (or one generic if no recipients)
    recipients = request.recipients if request.recipients else ["Generic"]
    
    for recipient in recipients:
        personalization = {
            **request.personalization,
            "recipient_name": recipient
        }
        
        try:
            video_type = VideoType(request.template)
        except ValueError:
            video_type = VideoType.INVESTOR_TEASER
        
        job = video_generator.create_video_job(
            loan_id=loan_id,
            video_type=video_type,
            personalization=personalization
        )
        jobs.append({
            "job_id": job.id,
            "recipient": recipient,
            "status": job.status.value
        })
    
    return {
        "roadshow_id": f"RS-{loan_id}-{len(jobs)}",
        "loan_id": loan_id,
        "recipient_count": len(jobs),
        "jobs": jobs,
        "message": f"Roadshow generation started for {len(jobs)} recipient(s)"
    }


@router.get("/video-types")
def get_video_types():
    """
    Get available video types and their descriptions.
    """
    return {
        "video_types": [
            {
                "type": "daily_update",
                "name": "Daily Update",
                "description": "Brief daily status update with key metrics and action items",
                "duration": "45 seconds"
            },
            {
                "type": "investor_teaser",
                "name": "Investor Teaser",
                "description": "Marketing video for potential buyers with deal highlights",
                "duration": "90 seconds"
            },
            {
                "type": "risk_alert",
                "name": "Risk Alert",
                "description": "Urgent notification about covenant breaches or market events",
                "duration": "60 seconds"
            },
            {
                "type": "deal_overview",
                "name": "Deal Overview",
                "description": "Comprehensive overview of deal structure and terms",
                "duration": "2 minutes"
            },
            {
                "type": "esg_report",
                "name": "ESG Report",
                "description": "Sustainability performance update with KPI status",
                "duration": "75 seconds"
            },
            {
                "type": "quarterly_review",
                "name": "Quarterly Review",
                "description": "Quarterly performance summary and outlook",
                "duration": "90 seconds"
            }
        ]
    }


@router.get("/preview-script/{loan_id}")
def preview_script(loan_id: int, video_type: str = "daily_update"):
    """
    Preview the script that would be generated for a video.
    Useful for reviewing before starting full video generation.
    """
    from sqlmodel import Session
    from ..db import engine
    from ..models.tables import Loan
    
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan:
            raise HTTPException(404, "Loan not found")
        
        try:
            vtype = VideoType(video_type)
        except ValueError:
            raise HTTPException(400, f"Invalid video type. Valid types: {[t.value for t in VideoType]}")
        
        script = video_generator.generate_script(loan, vtype)
        
        return {
            "loan_id": loan_id,
            "loan_name": loan.name,
            "video_type": video_type,
            "script_preview": script,
            "estimated_duration_seconds": 60 + len(script) // 20  # Rough estimate
        }


# ============ VIDEO RENDERING ============

class RenderVideoRequest(BaseModel):
    job_id: str
    avatar_style: str = "professional_female"  # professional_female, professional_male, casual
    background: str = "office"  # office, studio, branded
    resolution: str = "1080p"  # 720p, 1080p, 4k


# In-memory render jobs (in production, use database)
_render_jobs: Dict[str, Dict] = {}


@router.post("/render-video/{job_id}")
def render_video(job_id: str, request: RenderVideoRequest):
    """
    Start rendering a video from a generated script.
    Creates actual video file using MoviePy or falls back to GIF.
    """
    import uuid
    from datetime import datetime
    import threading
    
    # Get the original job with script
    original_job = video_generator.get_job(job_id)
    if not original_job:
        raise HTTPException(404, "Video job not found")
    
    if not original_job.script:
        raise HTTPException(400, "No script available for this job")
    
    # Create render job
    render_id = f"RENDER-{uuid.uuid4().hex[:8].upper()}"
    
    render_job = {
        "render_id": render_id,
        "source_job_id": job_id,
        "loan_id": original_job.loan_id,
        "script": original_job.script,
        "avatar_style": request.avatar_style,
        "background": request.background,
        "resolution": request.resolution,
        "status": "rendering",
        "progress": 10,
        "created_at": datetime.now().isoformat(),
        "estimated_completion": "30-60 seconds",
        "video_url": None,
        "video_path": None,
        "error": None
    }
    
    _render_jobs[render_id] = render_job
    
    # Start actual video rendering in background
    def render_in_background():
        try:
            render_job["progress"] = 30
            video_path = video_generator.render_video(job_id)
            
            if video_path and os.path.exists(video_path):
                render_job["status"] = "completed"
                render_job["progress"] = 100
                render_job["video_path"] = video_path
                render_job["video_url"] = f"/api/exports/download-video/{render_id}"
                render_job["completed_at"] = datetime.now().isoformat()
            else:
                render_job["status"] = "failed"
                render_job["error"] = "Video rendering failed - no output file"
        except Exception as e:
            render_job["status"] = "failed"
            render_job["error"] = str(e)
    
    # Run in background thread
    thread = threading.Thread(target=render_in_background)
    thread.start()
    
    return {
        "render_id": render_id,
        "status": "rendering",
        "progress": 10,
        "message": f"Video rendering started with {request.avatar_style} avatar",
        "estimated_completion": "30-60 seconds",
        "avatar_style": request.avatar_style,
        "background": request.background,
        "resolution": request.resolution,
        "check_status_url": f"/api/exports/render-status/{render_id}"
    }


@router.get("/render-status/{render_id}")
def get_render_status(render_id: str):
    """
    Get the status of a video render job.
    """
    if render_id not in _render_jobs:
        raise HTTPException(404, "Render job not found")
    
    job = _render_jobs[render_id]
    
    return {
        "render_id": render_id,
        "status": job["status"],
        "progress": job["progress"],
        "video_url": job["video_url"],
        "avatar_style": job["avatar_style"],
        "background": job["background"],
        "resolution": job["resolution"],
        "created_at": job["created_at"],
        "completed_at": job.get("completed_at"),
        "error": job["error"]
    }


@router.get("/download-video/{render_id}")
def download_video(render_id: str):
    """
    Download the rendered video file.
    """
    if render_id not in _render_jobs:
        raise HTTPException(404, "Render job not found")
    
    job = _render_jobs[render_id]
    
    if job["status"] != "completed":
        raise HTTPException(400, f"Video not ready. Status: {job['status']}")
    
    video_path = job.get("video_path")
    if not video_path or not os.path.exists(video_path):
        raise HTTPException(404, "Video file not found")
    
    # Determine content type
    if video_path.endswith('.mp4'):
        media_type = "video/mp4"
        filename = f"loantwin_video_{render_id}.mp4"
    elif video_path.endswith('.gif'):
        media_type = "image/gif"
        filename = f"loantwin_video_{render_id}.gif"
    else:
        media_type = "application/octet-stream"
        filename = f"loantwin_video_{render_id}"
    
    return FileResponse(
        path=video_path,
        media_type=media_type,
        filename=filename
    )


@router.get("/renders/{loan_id}")
def list_renders(loan_id: int, limit: int = 20):
    """
    List all video renders for a loan.
    """
    renders = [r for r in _render_jobs.values() if r["loan_id"] == loan_id]
    renders.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {
        "loan_id": loan_id,
        "count": len(renders[:limit]),
        "renders": [
            {
                "render_id": r["render_id"],
                "status": r["status"],
                "progress": r["progress"],
                "avatar_style": r["avatar_style"],
                "video_url": r["video_url"],
                "created_at": r["created_at"]
            }
            for r in renders[:limit]
        ]
    }
