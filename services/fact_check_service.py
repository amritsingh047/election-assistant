from typing import Dict, Any
from vertexai.generative_models import GenerativeModel
import vertexai.generative_models as generative_models
from services.gemini_service import gemini_service
from services.logger import setup_cloud_logger

logger = setup_cloud_logger(__name__)

class FactCheckService:
    """
    Enterprise-grade fact-checking service using Vertex AI.
    Analyzes election-related claims for misinformation with high precision.
    """
    def __init__(self):
        self.model = gemini_service.get_model()

    async def verify_claim(self, claim: str) -> Dict[str, Any]:
        if not self.model:
            return {"error": "AI Service unavailable"}

        try:
            prompt = f"""
            You are an expert non-partisan Election Fact-Checker. 
            Analyze the following claim: "{claim}"
            
            Determine:
            1. Status: Verified, Misleading, or False.
            2. Explanation: 1-2 sentence factual context.
            3. Sources: Mock or real official sources.
            
            Respond ONLY in JSON format.
            """
            
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0.2
                }
            )
            
            logger.info(f"Fact-check performed for: {claim[:30]}...")
            return response.text

        except Exception as e:
            logger.error(f"Fact-check failed: {str(e)}")
            return {"error": "Analysis failed", "details": str(e)}

fact_check_service = FactCheckService()
