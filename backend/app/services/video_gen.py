"""
LoanTwin Video Generation Service
=================================
Generate personalized video briefings and marketing teasers from loan data.
Uses AI for script generation and MoviePy for actual video rendering.
"""
from __future__ import annotations
import json
import uuid
import os
import textwrap
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel
from sqlmodel import Session
from ..db import engine
from ..models.tables import Loan
from pathlib import Path

try:
    from groq import Groq
    from ..config import GROQ_API_KEY
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    GROQ_API_KEY = None

try:
    from moviepy.editor import ImageSequenceClip, AudioFileClip
    MOVIEPY_AVAILABLE = True
except ImportError:
    MOVIEPY_AVAILABLE = False

try:
    from PIL import Image, ImageDraw, ImageFont
    import numpy as np
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    from gtts import gTTS
    GTTS_AVAILABLE = True
except ImportError:
    GTTS_AVAILABLE = False

# Eleven Labs for professional TTS
try:
    import requests
    from ..config import config
    ELEVEN_LABS_API_KEY = getattr(config, 'ELEVEN_LABS_API_KEY', None)
    ELEVEN_LABS_AVAILABLE = bool(ELEVEN_LABS_API_KEY)
    print(f"[INIT] Eleven Labs available: {ELEVEN_LABS_AVAILABLE}, Key present: {bool(ELEVEN_LABS_API_KEY)}")
except Exception as e:
    print(f"[INIT] Eleven Labs import failed: {e}")
    ELEVEN_LABS_AVAILABLE = False
    ELEVEN_LABS_API_KEY = None

# imageio for video creation without ImageMagick
try:
    import imageio
    IMAGEIO_AVAILABLE = True
except ImportError:
    IMAGEIO_AVAILABLE = False

# Directory for storing generated videos
VIDEO_OUTPUT_DIR = Path(__file__).parent.parent.parent / "data" / "videos"
VIDEO_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


class VideoType(str, Enum):
    DAILY_UPDATE = "daily_update"
    INVESTOR_TEASER = "investor_teaser"
    RISK_ALERT = "risk_alert"
    DEAL_OVERVIEW = "deal_overview"
    ESG_REPORT = "esg_report"
    QUARTERLY_REVIEW = "quarterly_review"


class VideoStatus(str, Enum):
    QUEUED = "queued"
    SCRIPTING = "scripting"
    RENDERING = "rendering"
    COMPLETED = "completed"
    FAILED = "failed"


class VideoJob(BaseModel):
    id: str
    loan_id: int
    video_type: VideoType
    status: VideoStatus
    created_at: str
    completed_at: Optional[str] = None
    script: Optional[str] = None
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_seconds: int = 60
    personalization: Dict[str, Any] = {}
    error: Optional[str] = None


# In-memory store for video jobs
_video_jobs: Dict[str, VideoJob] = {}


class ScriptTemplate(BaseModel):
    """Template for video scripts."""
    type: VideoType
    intro: str
    body_template: str
    outro: str
    suggested_visuals: List[str]
    duration_target_seconds: int


# Pre-defined script templates
SCRIPT_TEMPLATES = {
    VideoType.DAILY_UPDATE: ScriptTemplate(
        type=VideoType.DAILY_UPDATE,
        intro="Good morning. Here's your daily update on {deal_name}.",
        body_template="""
Current Status:
- Trade Readiness: {trade_readiness}%
- Open Obligations: {open_obligations}
- Covenant Headroom: {covenant_headroom}

Key Events:
{key_events}

Action Items:
{action_items}
""",
        outro="That's all for today. Reach out if you need deeper analysis.",
        suggested_visuals=["dashboard_screenshot", "trend_chart", "action_list"],
        duration_target_seconds=45
    ),
    
    VideoType.INVESTOR_TEASER: ScriptTemplate(
        type=VideoType.INVESTOR_TEASER,
        intro="Presenting an exclusive opportunity: {deal_name}.",
        body_template="""
Deal Highlights:
- Total Commitment: {currency} {total_commitment}
- Facility Type: {facility_type}
- Margin: {margin} basis points over {base_rate}
- Maturity: {maturity_date}

Credit Story:
{borrower_name} is a leading player in {sector} with strong fundamentals.

ESG Profile:
{esg_summary}

Trade Terms:
- Transfer Mode: {transfer_mode}
- Settlement: T+{settlement_days}
- Pre-Cleared Buyers: {pre_cleared_count}
""",
        outro="Contact your relationship manager to express interest. Pre-cleared buyers can settle T+0.",
        suggested_visuals=["company_logo", "facility_structure", "pricing_grid", "trade_terms"],
        duration_target_seconds=90
    ),
    
    VideoType.RISK_ALERT: ScriptTemplate(
        type=VideoType.RISK_ALERT,
        intro="Risk Alert for {deal_name}.",
        body_template="""
Alert Type: {alert_type}
Severity: {severity}

Details:
{alert_details}

Impact Assessment:
{impact_analysis}

Recommended Actions:
{recommended_actions}
""",
        outro="Please review and take necessary action. LoanTwin Agent has drafted responses for your approval.",
        suggested_visuals=["alert_icon", "impact_chart", "action_buttons"],
        duration_target_seconds=60
    ),
    
    VideoType.DEAL_OVERVIEW: ScriptTemplate(
        type=VideoType.DEAL_OVERVIEW,
        intro="Deal Overview: {deal_name}.",
        body_template="""
Parties:
- Borrower: {borrower_name}
- Agent Bank: {agent_bank}
- Syndicate Size: {syndicate_size} lenders

Facilities:
{facilities_summary}

Key Terms:
- Governing Law: {governing_law}
- Currency: {currency}
- Total Commitment: {total_commitment}
- Maturity: {maturity_date}

Covenants:
{covenants_summary}

ESG Features:
{esg_features}
""",
        outro="For detailed analysis, access the Digital Loan Record in LoanTwin OS.",
        suggested_visuals=["org_chart", "facility_pie", "covenant_gauges", "timeline"],
        duration_target_seconds=120
    ),
    
    VideoType.ESG_REPORT: ScriptTemplate(
        type=VideoType.ESG_REPORT,
        intro="ESG Performance Report for {deal_name}.",
        body_template="""
Sustainability-Linked Loan Status:
Current Margin: {current_margin} bps
ESG Adjustment: {esg_adjustment} bps

KPI Performance:
{kpi_details}

Verification Status: {verification_status}
Next Test Date: {next_test_date}

Year-to-Date Performance:
{ytd_performance}
""",
        outro="Independent verification by {verifier_name} confirms these results.",
        suggested_visuals=["esg_dashboard", "kpi_charts", "verification_badge"],
        duration_target_seconds=75
    ),
    
    VideoType.QUARTERLY_REVIEW: ScriptTemplate(
        type=VideoType.QUARTERLY_REVIEW,
        intro="Quarterly Review: {deal_name} - Q{quarter} {year}.",
        body_template="""
Portfolio Performance:
{portfolio_summary}

Compliance Status:
- Financial Covenants: {covenant_status}
- Information Undertakings: {info_status}
- ESG KPIs: {esg_status}

Key Events This Quarter:
{quarterly_events}

Outlook:
{outlook}
""",
        outro="Full quarterly report available in the Document Center.",
        suggested_visuals=["quarterly_chart", "compliance_checklist", "trend_analysis"],
        duration_target_seconds=90
    )
}


class VideoGenerator:
    """Generates video content from loan data."""
    
    def __init__(self):
        self.client = None
        if GROQ_AVAILABLE and GROQ_API_KEY:
            self.client = Groq(api_key=GROQ_API_KEY)
    
    def generate_script(self, loan: Loan, video_type: VideoType, personalization: Dict = None) -> str:
        """Generate a video script from loan data."""
        template = SCRIPT_TEMPLATES.get(video_type)
        if not template:
            return "Script template not found."
        
        # Parse DLR
        dlr = {}
        if loan.dlr_json:
            try:
                dlr = json.loads(loan.dlr_json)
            except:
                pass
        
        # Build context - safely access loan attributes
        context = {
            "deal_name": loan.name,
            "borrower_name": getattr(loan, 'borrower_name', None) or dlr.get("borrower_name", "Borrower"),
            "governing_law": getattr(loan, 'governing_law', None) or dlr.get("governing_law", "English Law"),
            "currency": getattr(loan, 'currency', None) or dlr.get("currency", "GBP"),
            "facility_type": getattr(loan, 'facility_type', None) or dlr.get("facility_type", "Term Loan"),
            "margin": getattr(loan, 'margin_bps', None) or dlr.get("margin_bps", 175),
            "base_rate": dlr.get("base_rate", "SONIA"),
            "maturity_date": dlr.get("maturity_date", getattr(loan, 'closing_date', None) or "TBD"),
            "trade_readiness": self._calculate_trade_readiness(loan),
            "open_obligations": len([o for o in dlr.get("obligations", []) if o.get("status") != "Completed"]),
            "total_commitment": self._format_amount(self._get_total_commitment(dlr)),
            "sector": dlr.get("sector", "Industrial"),
            "transfer_mode": dlr.get("transferability", {}).get("mode", "Assignment"),
            "settlement_days": 5,
            "pre_cleared_count": 4,
            "agent_bank": dlr.get("parties", [{}])[0].get("name", "Agent Bank") if dlr.get("parties") else "Agent Bank",
            "syndicate_size": len(dlr.get("parties", [])) or 8,
            "quarter": (datetime.now().month - 1) // 3 + 1,
            "year": datetime.now().year,
        }
        
        # Add personalization
        if personalization:
            context.update(personalization)
        
        # Build script from template
        script_parts = []
        
        # Intro
        script_parts.append(template.intro.format(**context))
        
        # Body - Fill in placeholders
        body = template.body_template
        
        # Handle complex placeholders
        if "{key_events}" in body:
            context["key_events"] = "- Compliance certificate due in 15 days\n- Q4 covenant test approaching"
        if "{action_items}" in body:
            context["action_items"] = "- Review Agent recommendation for ESG verifier\n- Approve draft waiver request"
        if "{facilities_summary}" in body:
            facilities = dlr.get("facilities", [])
            context["facilities_summary"] = "\n".join([f"- {f.get('name', 'Facility')}: {f.get('amount', 'N/A')}" for f in facilities]) or "- Term Loan A: £200M\n- Revolving Credit: £50M"
        if "{covenants_summary}" in body:
            covenants = dlr.get("covenants", [])
            context["covenants_summary"] = "\n".join([f"- {c.get('name', 'Covenant')}: {c.get('threshold', 'N/A')}" for c in covenants]) or "- Leverage Ratio < 4.0x\n- Interest Cover > 3.0x"
        if "{esg_summary}" in body or "{esg_features}" in body:
            context["esg_summary"] = "Sustainability-Linked with 3 KPIs targeting emissions reduction and renewable energy adoption."
            context["esg_features"] = context["esg_summary"]
        if "{kpi_details}" in body:
            context["kpi_details"] = "- GHG Emissions: On Track (-12% YoY)\n- Renewable Energy: At Risk (28% vs 30% target)"
        if "{alert_type}" in body:
            context["alert_type"] = personalization.get("alert_type", "Covenant Headroom Warning")
            context["severity"] = personalization.get("severity", "Medium")
            context["alert_details"] = personalization.get("alert_details", "Leverage ratio approaching threshold")
            context["impact_analysis"] = "Potential margin step-up of 25 bps if breached"
            context["recommended_actions"] = "1. Request updated projections from Borrower\n2. Consider covenant reset discussions"
        if "{covenant_status}" in body:
            context["covenant_status"] = "All compliant"
            context["info_status"] = "1 item pending"
            context["esg_status"] = "2 of 3 KPIs on track"
            context["portfolio_summary"] = "Deal performing in line with expectations"
            context["quarterly_events"] = "- Amendment signed for ESG margin adjustment\n- Rating affirmed by S&P"
            context["outlook"] = "Stable outlook with no material concerns"
        if "{current_margin}" in body:
            context["current_margin"] = loan.margin_bps or 175
            context["esg_adjustment"] = -5
            context["verification_status"] = "Third-Party Verified"
            context["next_test_date"] = (date.today() + timedelta(days=90)).isoformat()
            context["ytd_performance"] = "ESG targets met, resulting in -5 bps margin reduction"
            context["verifier_name"] = "KPMG Sustainability Services"
        if "{covenant_headroom}" in body:
            context["covenant_headroom"] = "35%"
        
        body = body.format(**context)
        script_parts.append(body)
        
        # Outro
        script_parts.append(template.outro.format(**context))
        
        return "\n\n".join(script_parts)
    
    def enhance_script_with_llm(self, script: str, video_type: VideoType) -> str:
        """Use LLM to polish the script for natural speech."""
        if not self.client:
            return script
        
        try:
            completion = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a professional video script writer for financial services. Rewrite the following script to sound more natural and engaging for video narration. Keep all the facts and numbers accurate. Use a professional but approachable tone."},
                    {"role": "user", "content": f"Polish this {video_type.value} script:\n\n{script}"}
                ],
                temperature=0.4,
                max_tokens=1000
            )
            return completion.choices[0].message.content
        except:
            return script
    
    def create_video_job(self, loan_id: int, video_type: VideoType, personalization: Dict = None) -> VideoJob:
        """Create a new video generation job."""
        job = VideoJob(
            id=str(uuid.uuid4()),
            loan_id=loan_id,
            video_type=video_type,
            status=VideoStatus.QUEUED,
            created_at=datetime.now().isoformat(),
            personalization=personalization or {}
        )
        _video_jobs[job.id] = job
        
        # Process the job (in production, this would be async)
        self._process_job(job)
        
        return job
    
    def _process_job(self, job: VideoJob):
        """Process a video generation job."""
        try:
            job.status = VideoStatus.SCRIPTING
            
            # Get loan data
            with Session(engine) as session:
                loan = session.get(Loan, job.loan_id)
                if not loan:
                    job.status = VideoStatus.FAILED
                    job.error = "Loan not found"
                    return
            
            # Generate script
            script = self.generate_script(loan, job.video_type, job.personalization)
            
            # Optionally enhance with LLM
            if self.client:
                script = self.enhance_script_with_llm(script, job.video_type)
            
            job.script = script
            job.status = VideoStatus.RENDERING
            
            # Set duration based on template
            job.duration_seconds = SCRIPT_TEMPLATES[job.video_type].duration_target_seconds
            
            # Don't auto-generate video - wait for render request
            job.video_url = None
            job.thumbnail_url = None
            
            job.status = VideoStatus.COMPLETED
            job.completed_at = datetime.now().isoformat()
            
        except Exception as e:
            job.status = VideoStatus.FAILED
            job.error = str(e)
    
    def render_video(self, job_id: str) -> Optional[str]:
        """Actually render the video file and return the path."""
        job = self.get_job(job_id)
        if not job or not job.script:
            return None
        
        # Use PIL + MoviePy ImageSequenceClip (no ImageMagick needed)
        try:
            print(f"[VIDEO] Starting PIL video rendering for job {job_id}")
            video_path = self._create_pil_video(job)
            print(f"[VIDEO] PIL video created at: {video_path}")
            job.video_url = f"/api/videos/{job.id}/download"
            return video_path
        except Exception as e:
            import traceback
            print(f"[VIDEO] PIL video rendering failed: {e}")
            traceback.print_exc()
            # Fall back to GIF
            return self._create_simple_video(job)
    
    def _create_pil_video(self, job: VideoJob) -> str:
        """Create MP4 video using PIL frames + imageio (no ImageMagick needed)."""
        print("[VIDEO] _create_pil_video starting...")
        print(f"[VIDEO] MOVIEPY_AVAILABLE: {MOVIEPY_AVAILABLE}, PIL_AVAILABLE: {PIL_AVAILABLE}, IMAGEIO_AVAILABLE: {IMAGEIO_AVAILABLE}, ELEVEN_LABS_AVAILABLE: {ELEVEN_LABS_AVAILABLE}")
        
        if not PIL_AVAILABLE:
            raise Exception("PIL not available")
        
        # Video dimensions
        width, height = 1280, 720
        fps = 24
        
        # Parse script into slides
        lines = job.script.strip().split('\n')
        slides = []
        current_slide = []
        
        for line in lines:
            if line.strip():
                current_slide.append(line)
            elif current_slide:
                slides.append('\n'.join(current_slide))
                current_slide = []
        
        if current_slide:
            slides.append('\n'.join(current_slide))
        
        slides = slides[:8]  # Limit to 8 slides
        duration_per_slide = max(3, job.duration_seconds // len(slides)) if slides else 5
        frames_per_slide = fps * duration_per_slide
        
        # Try to load a font
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
            title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
            small_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
        except:
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
                title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
                small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
            except:
                font = ImageFont.load_default()
                title_font = font
                small_font = font
        
        # Create frames
        all_frames = []
        
        for i, slide_text in enumerate(slides):
            # Create base image
            img = Image.new('RGB', (width, height), color=(10, 22, 40))
            draw = ImageDraw.Draw(img)
            
            # Draw gradient-like effect at top
            for y in range(100):
                alpha = int(255 * (1 - y / 100))
                draw.line([(0, y), (width, y)], fill=(0, int(212 * alpha / 255), int(170 * alpha / 255)))
            
            # Draw title
            draw.text((width // 2, 50), "LoanTwin OS", fill=(0, 212, 170), font=title_font, anchor="mt")
            
            # Draw subtitle
            draw.text((width // 2, 90), f"Video Briefing • {job.video_type.value.replace('_', ' ').title()}", 
                     fill=(150, 150, 150), font=small_font, anchor="mt")
            
            # Wrap and draw main text
            wrapped = textwrap.fill(slide_text, width=70)
            lines_list = wrapped.split('\n')
            
            y_offset = 180
            for line in lines_list[:12]:  # Max 12 lines per slide
                # Check if it's a heading (starts with capital letter after dash)
                if line.strip().startswith('-') or line.strip().startswith('•'):
                    draw.text((100, y_offset), line.strip(), fill=(200, 200, 200), font=font)
                elif ':' in line and len(line.split(':')[0]) < 30:
                    # Key-value pair - highlight key
                    parts = line.split(':', 1)
                    draw.text((100, y_offset), parts[0] + ":", fill=(0, 212, 170), font=font)
                    if len(parts) > 1:
                        key_width = draw.textlength(parts[0] + ": ", font=font)
                        draw.text((100 + key_width, y_offset), parts[1], fill=(255, 255, 255), font=font)
                else:
                    draw.text((100, y_offset), line, fill=(255, 255, 255), font=font)
                y_offset += 38
            
            # Draw slide indicator
            draw.text((width // 2, height - 40), f"Slide {i + 1} / {len(slides)}", 
                     fill=(100, 100, 100), font=small_font, anchor="mt")
            
            # Draw progress bar
            progress_width = int((width - 200) * (i + 1) / len(slides))
            draw.rectangle([(100, height - 20), (width - 100, height - 15)], fill=(30, 40, 60))
            draw.rectangle([(100, height - 20), (100 + progress_width, height - 15)], fill=(0, 212, 170))
            
            # Convert to numpy array
            frame_array = np.array(img)
            
            # Add frame multiple times for duration
            for _ in range(frames_per_slide):
                all_frames.append(frame_array)
        
        if not all_frames:
            raise Exception("No frames created")
        
        print(f"[VIDEO] Created {len(all_frames)} frames for {len(slides)} slides")
        
        # Use imageio for MP4 creation (no ImageMagick needed)
        if IMAGEIO_AVAILABLE:
            print("[VIDEO] Using imageio to create MP4 video...")
            
            output_path = VIDEO_OUTPUT_DIR / f"{job.id}.mp4"
            print(f"[VIDEO] Output path: {output_path}")
            
            try:
                # Create video with imageio
                writer = imageio.get_writer(str(output_path), fps=fps, codec='libx264', 
                                           quality=8, pixelformat='yuv420p')
                
                for frame in all_frames:
                    writer.append_data(frame)
                
                writer.close()
                print(f"[VIDEO] MP4 video created successfully at {output_path}")
                
                # Generate audio with Eleven Labs if available
                print(f"[VIDEO] Checking audio generation... ELEVEN_LABS_AVAILABLE={ELEVEN_LABS_AVAILABLE}")
                if ELEVEN_LABS_AVAILABLE:
                    try:
                        print("[VIDEO] Calling Eleven Labs for audio...")
                        audio_path = self._generate_eleven_labs_audio(job)
                        print(f"[VIDEO] Audio path returned: {audio_path}")
                        if audio_path:
                            # Merge audio with video using ffmpeg or moviepy
                            self._merge_audio_video(str(output_path), audio_path)
                    except Exception as e:
                        import traceback
                        print(f"[VIDEO] Eleven Labs audio generation failed: {e}")
                        traceback.print_exc()
                else:
                    print("[VIDEO] Eleven Labs not available, skipping audio")
                
                return str(output_path)
            except Exception as e:
                print(f"[VIDEO] imageio MP4 creation failed: {e}")
                import traceback
                traceback.print_exc()
        
        # Try MoviePy as fallback
        if MOVIEPY_AVAILABLE:
            print("[VIDEO] Using MoviePy to create video...")
            
            output_path = VIDEO_OUTPUT_DIR / f"{job.id}.mp4"
            
            clip = ImageSequenceClip(all_frames, fps=fps)
            
            clip.write_videofile(
                str(output_path),
                fps=fps,
                codec='libx264',
                logger=None
            )
            
            clip.close()
            return str(output_path)
        
        # Fall back to GIF if nothing else works
        return self._create_simple_video(job)
    
    def _generate_eleven_labs_audio(self, job: VideoJob) -> Optional[str]:
        """Generate TTS audio using Eleven Labs API."""
        if not ELEVEN_LABS_AVAILABLE or not job.script:
            return None
        
        print("[VIDEO] Generating audio with Eleven Labs...")
        
        # Use a professional voice
        voice_id = "21m00Tcm4TlvDq8ikWAM"  # Rachel - calm, professional
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVEN_LABS_API_KEY
        }
        
        # Clean up script for TTS
        clean_script = job.script.replace("**", "").replace("##", "").replace("*", "")
        
        data = {
            "text": clean_script[:2500],  # Limit text length
            "model_id": "eleven_turbo_v2",  # Updated model for free tier
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75
            }
        }
        
        try:
            response = requests.post(url, json=data, headers=headers, timeout=60)
            
            if response.status_code == 200:
                audio_path = VIDEO_OUTPUT_DIR / f"{job.id}_audio.mp3"
                with open(audio_path, 'wb') as f:
                    f.write(response.content)
                print(f"[VIDEO] Eleven Labs audio saved to {audio_path}")
                return str(audio_path)
            else:
                print(f"[VIDEO] Eleven Labs API error: {response.status_code} - {response.text}")
                return None
        except Exception as e:
            print(f"[VIDEO] Eleven Labs request failed: {e}")
            return None
    
    def _merge_audio_video(self, video_path: str, audio_path: str):
        """Merge audio into video file using ffmpeg."""
        import subprocess
        
        try:
            temp_path = video_path.replace('.mp4', '_with_audio.mp4')
            
            # Use ffmpeg to merge audio and video
            cmd = [
                'ffmpeg', '-y',
                '-i', video_path,
                '-i', audio_path,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-shortest',
                temp_path
            ]
            
            print(f"[VIDEO] Running ffmpeg merge: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            
            if result.returncode == 0:
                # Replace original with merged version
                os.replace(temp_path, video_path)
                os.remove(audio_path)
                print(f"[VIDEO] Audio merged successfully into {video_path}")
            else:
                print(f"[VIDEO] ffmpeg error: {result.stderr}")
                # Try with MoviePy as fallback
                if MOVIEPY_AVAILABLE:
                    self._merge_with_moviepy(video_path, audio_path)
                    
        except subprocess.TimeoutExpired:
            print("[VIDEO] ffmpeg merge timed out")
        except FileNotFoundError:
            print("[VIDEO] ffmpeg not found, trying MoviePy...")
            if MOVIEPY_AVAILABLE:
                self._merge_with_moviepy(video_path, audio_path)
        except Exception as e:
            print(f"[VIDEO] Audio merge failed: {e}")
    
    def _merge_with_moviepy(self, video_path: str, audio_path: str):
        """Fallback merge using MoviePy."""
        try:
            from moviepy.editor import VideoFileClip, AudioFileClip as AFC
            video = VideoFileClip(video_path)
            audio = AFC(audio_path)
            
            if audio.duration > video.duration:
                audio = audio.subclip(0, video.duration)
            
            final = video.set_audio(audio)
            temp_path = video_path.replace('.mp4', '_temp.mp4')
            final.write_videofile(temp_path, codec='libx264', audio_codec='aac', logger=None)
            
            video.close()
            audio.close()
            final.close()
            
            os.replace(temp_path, video_path)
            os.remove(audio_path)
            print(f"[VIDEO] Audio merged with MoviePy successfully")
        except Exception as e:
            print(f"[VIDEO] MoviePy merge failed: {e}")
    
    def _create_video_with_moviepy(self, job: VideoJob) -> str:
        """Create video using MoviePy with text slides."""
        from moviepy.editor import TextClip, CompositeVideoClip, ColorClip, concatenate_videoclips
        
        # Video settings
        width, height = 1280, 720
        fps = 24
        
        # Parse script into slides
        lines = job.script.strip().split('\n')
        slides = []
        current_slide = []
        
        for line in lines:
            if line.strip():
                current_slide.append(line)
            elif current_slide:
                slides.append('\n'.join(current_slide))
                current_slide = []
        
        if current_slide:
            slides.append('\n'.join(current_slide))
        
        # Limit slides and calculate duration per slide
        slides = slides[:10]  # Max 10 slides
        duration_per_slide = max(3, job.duration_seconds // len(slides)) if slides else 5
        
        # Create video clips for each slide
        clips = []
        for i, slide_text in enumerate(slides):
            # Create background
            bg_color = (10, 22, 40)  # Dark blue matching LoanTwin theme
            
            # Wrap text
            wrapped = textwrap.fill(slide_text, width=50)
            
            try:
                # Create text clip
                txt_clip = TextClip(
                    wrapped,
                    fontsize=32,
                    color='white',
                    font='Arial',
                    size=(width - 100, None),
                    method='caption',
                    align='center'
                ).set_duration(duration_per_slide).set_position('center')
                
                # Create background
                bg = ColorClip(size=(width, height), color=bg_color).set_duration(duration_per_slide)
                
                # Add LoanTwin branding text at top
                title = TextClip(
                    "LoanTwin OS",
                    fontsize=28,
                    color='#00D4AA',
                    font='Arial-Bold'
                ).set_duration(duration_per_slide).set_position(('center', 30))
                
                # Slide number at bottom
                slide_num = TextClip(
                    f"Slide {i + 1} of {len(slides)}",
                    fontsize=16,
                    color='gray'
                ).set_duration(duration_per_slide).set_position(('center', height - 50))
                
                # Composite
                clip = CompositeVideoClip([bg, txt_clip, title, slide_num])
                clips.append(clip)
            except Exception as e:
                print(f"Error creating slide {i}: {e}")
                continue
        
        if not clips:
            raise Exception("No slides could be created")
        
        # Concatenate all clips
        final_video = concatenate_videoclips(clips, method="compose")
        
        # Generate audio if available
        audio_path = None
        if GTTS_AVAILABLE:
            try:
                audio_path = self._generate_tts_audio(job)
                if audio_path and os.path.exists(audio_path):
                    audio = AudioFileClip(audio_path)
                    final_video = final_video.set_audio(audio)
            except Exception as e:
                print(f"TTS audio generation failed: {e}")
        
        # Output path
        output_path = VIDEO_OUTPUT_DIR / f"{job.id}.mp4"
        
        # Write video file
        final_video.write_videofile(
            str(output_path),
            fps=fps,
            codec='libx264',
            audio_codec='aac' if audio_path else None,
            temp_audiofile='temp-audio.m4a',
            remove_temp=True,
            logger=None  # Suppress output
        )
        
        # Cleanup
        final_video.close()
        if audio_path and os.path.exists(audio_path):
            os.remove(audio_path)
        
        return str(output_path)
    
    def _create_simple_video(self, job: VideoJob) -> str:
        """Create a simple video using PIL images converted to frames."""
        from PIL import Image, ImageDraw, ImageFont
        import struct
        import zlib
        
        # Video dimensions
        width, height = 1280, 720
        
        # Parse script into slides
        lines = job.script.strip().split('\n')
        slides = []
        current_slide = []
        
        for line in lines:
            if line.strip():
                current_slide.append(line)
            elif current_slide:
                slides.append('\n'.join(current_slide))
                current_slide = []
        
        if current_slide:
            slides.append('\n'.join(current_slide))
        
        slides = slides[:8]  # Limit to 8 slides
        
        # Create frames for each slide
        frames = []
        fps = 1  # 1 frame per second for simple video
        frames_per_slide = max(3, job.duration_seconds // len(slides)) if slides else 5
        
        for i, slide_text in enumerate(slides):
            # Create image
            img = Image.new('RGB', (width, height), color=(10, 22, 40))
            draw = ImageDraw.Draw(img)
            
            # Try to use a font
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 32)
                title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
            except:
                font = ImageFont.load_default()
                title_font = font
            
            # Draw title
            draw.text((width // 2, 40), "LoanTwin OS", fill=(0, 212, 170), font=title_font, anchor="mt")
            
            # Wrap and draw text
            wrapped = textwrap.fill(slide_text, width=60)
            
            # Calculate text position for centering
            y_offset = 150
            for line in wrapped.split('\n'):
                draw.text((width // 2, y_offset), line, fill='white', font=font, anchor="mt")
                y_offset += 40
            
            # Draw slide number
            draw.text((width // 2, height - 40), f"Slide {i + 1} / {len(slides)}", fill='gray', font=font, anchor="mt")
            
            # Add frame multiple times for duration
            for _ in range(frames_per_slide):
                frames.append(img.copy())
        
        # Generate simple GIF (more compatible) or MP4
        output_path = VIDEO_OUTPUT_DIR / f"{job.id}.gif"
        
        if frames:
            frames[0].save(
                str(output_path),
                save_all=True,
                append_images=frames[1:],
                duration=1000,  # 1 second per frame
                loop=0
            )
        
        return str(output_path)
    
    def _generate_tts_audio(self, job: VideoJob) -> Optional[str]:
        """Generate text-to-speech audio from script."""
        if not GTTS_AVAILABLE:
            return None
        
        try:
            # Clean script for TTS
            clean_script = job.script.replace('-', '').replace(':', '.').replace('\n', ' ')
            clean_script = ' '.join(clean_script.split())  # Normalize whitespace
            
            # Limit length for TTS
            if len(clean_script) > 2000:
                clean_script = clean_script[:2000] + "..."
            
            tts = gTTS(text=clean_script, lang='en', slow=False)
            audio_path = VIDEO_OUTPUT_DIR / f"{job.id}_audio.mp3"
            tts.save(str(audio_path))
            
            return str(audio_path)
        except Exception as e:
            print(f"TTS generation failed: {e}")
            return None
    
    def get_video_path(self, job_id: str) -> Optional[str]:
        """Get the path to a rendered video file."""
        # Check for MP4 first, then GIF
        mp4_path = VIDEO_OUTPUT_DIR / f"{job_id}.mp4"
        gif_path = VIDEO_OUTPUT_DIR / f"{job_id}.gif"
        
        if mp4_path.exists():
            return str(mp4_path)
        elif gif_path.exists():
            return str(gif_path)
        return None
    
    def get_job(self, job_id: str) -> Optional[VideoJob]:
        """Get a video job by ID."""
        return _video_jobs.get(job_id)
    
    def list_jobs(self, loan_id: Optional[int] = None) -> List[VideoJob]:
        """List all video jobs, optionally filtered by loan."""
        jobs = list(_video_jobs.values())
        if loan_id:
            jobs = [j for j in jobs if j.loan_id == loan_id]
        return sorted(jobs, key=lambda j: j.created_at, reverse=True)
    
    def _calculate_trade_readiness(self, loan: Loan) -> int:
        """Calculate trade readiness score."""
        # Simplified calculation
        return 75  # Base score
    
    def _get_total_commitment(self, dlr: Dict) -> float:
        """Get total commitment from DLR."""
        total = 0
        for f in dlr.get("facilities", []):
            amt = str(f.get("amount", 0)).replace(",", "").replace("£", "").replace("$", "")
            try:
                total += float(amt)
            except:
                pass
        return total if total > 0 else 350000000
    
    def _format_amount(self, amount: float) -> str:
        """Format large amounts for display."""
        if amount >= 1000000000:
            return f"{amount / 1000000000:.1f}B"
        elif amount >= 1000000:
            return f"{amount / 1000000:.0f}M"
        else:
            return f"{amount:,.0f}"


# Singleton instance
video_generator = VideoGenerator()
