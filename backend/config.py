from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    """
    Enterprise application configuration using Pydantic Settings.
    Ensures type-safe and validated environment variables.
    """
    APP_NAME: str = "Smart Election Assistant"
    DEBUG: bool = False
    PORT: int = 8080
    
    # Google Cloud Config
    GOOGLE_CLOUD_PROJECT: str = "649488092534"
    GOOGLE_CLOUD_REGION: str = "us-central1"
    GOOGLE_API_KEY: Optional[str] = None # Will be resolved via CloudService in production
    
    # Security
    SECRET_KEY: str = "my_super_secret_hackathon_key_do_not_use_in_prod"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    class Config:
        env_file = ".env"

settings = Settings()
