"""
Core application configuration using Pydantic Settings.
"""
from pydantic_settings import BaseSettings
from pydantic import Field, field_validator
from typing import List, Union
import json


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    APP_NAME: str = "Alfred Pennyworth"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = Field(..., min_length=32)
    
    API_V1_PREFIX: str = "/api/v1"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    
    REDIS_URL: str
    REDIS_PASSWORD: str = ""
    
    OPENAI_API_KEY: str
    HUGGINGFACE_API_KEY: str = ""
    
    GPT_MODEL: str = "gpt-4-turbo-preview"
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    ML_CONFIDENCE_THRESHOLD: float = 0.70
    PATTERN_DETECTION_WINDOW_DAYS: int = 14
    MIN_SAMPLES_FOR_PREDICTION: int = 7
    
    QUIET_HOURS_START: str = "22:00"
    QUIET_HOURS_END: str = "07:00"
    MAX_INTERVENTIONS_PER_DAY: int = 6
    INTERVENTION_COOLDOWN_HOURS: int = 2
    
    GOOGLE_CALENDAR_CREDENTIALS_FILE: str = "credentials.json"
    GOOGLE_CALENDAR_TOKEN_FILE: str = "token.json"
    
    APPLE_HEALTH_API_KEY: str = ""
    WHOOP_API_KEY: str = ""
    OURA_API_KEY: str = ""
    
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    
    ENABLE_METRICS: bool = True
    METRICS_PORT: int = 9090
    LOG_LEVEL: str = "INFO"
    
    CELERY_BROKER_URL: str
    CELERY_RESULT_BACKEND: str
    
    CORS_ORIGINS: Union[List[str], str] = ["http://localhost:3000", "http://localhost:8000"]
    
    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """Parse CORS_ORIGINS from various input formats."""
        if isinstance(v, str):
            # Handle empty string
            if not v or v.strip() == "":
                return ["http://localhost:3000", "http://localhost:8000"]
            
            # Try to parse as JSON first
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass
            
            # Handle comma-separated string
            if "," in v:
                return [origin.strip() for origin in v.split(",") if origin.strip()]
            
            # Single origin
            return [v.strip()]
        
        # Already a list
        if isinstance(v, list):
            return v
        
        # Fallback to default
        return ["http://localhost:3000", "http://localhost:8000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()