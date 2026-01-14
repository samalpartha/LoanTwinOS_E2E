import os

class Config:
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")
    ELEVEN_LABS_API_KEY = os.getenv("ELEVEN_LABS_API_KEY", "")
    
config = Config()
