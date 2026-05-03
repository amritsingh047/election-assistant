import os
import vertexai
from vertexai.generative_models import GenerativeModel, SafetySetting, Part, Tool
from typing import List, Optional
from services.cloud_service import cloud_service
from services.logger import setup_cloud_logger

logger = setup_cloud_logger(__name__)

class GeminiService:
    """
    Enterprise AI Service using Google Vertex AI.
    Provides high-performance multimodal reasoning for civic processes.
    """
    def __init__(self):
        self.project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "election-assistant-app-123")
        self.location = os.getenv("GOOGLE_CLOUD_REGION", "us-central1")
        self.initialized = False
        self._initialize()

    def _initialize(self) -> None:
        """
        Initializes the Vertex AI client with Google Search Grounding.
        Handles authentication via application default credentials.
        """
        try:
            vertexai.init(project=self.project_id, location=self.location)
            # Initialize with Google Search Grounding for high-trust responses
            tools: List[Tool] = [
                Tool.from_google_search_retrieval(
                    google_search_retrieval=vertexai.generative_models.grounding.GoogleSearchRetrieval()
                )
            ]
            self.model = GenerativeModel("gemini-1.5-flash", tools=tools)
            self.initialized = True
            logger.info("Vertex AI initialized with Google Search Grounding.")
        except Exception as e:
            logger.error(f"Vertex AI initialization failed: {e}")
            self.initialized = False

    def get_model(self) -> Optional[GenerativeModel]:
        """
        Returns the initialized GenerativeModel instance.
        
        Returns:
            Optional[GenerativeModel]: The model instance or None if initialization failed.
        """
        if not self.initialized:
            self._initialize()
        return self.model if self.initialized else None

# Singleton instance
gemini_service = GeminiService()
