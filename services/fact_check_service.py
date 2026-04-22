from typing import Dict, Any
from google.genai import types
from services.gemini_service import gemini_service
from services.logger import setup_cloud_logger

logger = setup_cloud_logger(__name__)

class FactCheckService:
    def __init__(self):
        self.client = gemini_service.get_client()

    async def verify_claim(self, claim: str) -> Dict[str, Any]:
        """
        Analyzes a political or election-related claim for potential misinformation.
        """
        if not self.client:
            return {"error": "AI Service unavailable"}

        try:
            prompt = f"""
            You are an expert non-partisan Election Fact-Checker. 
            Analyze the following claim: "{claim}"
            
            1. Determine if it is 'Verified', 'Misleading', or 'False'.
            2. Provide a 1-2 sentence explanation of the facts.
            3. Cite (mock) official sources or typical government processes.
            
            Respond ONLY in JSON format:
            {{
                "status": "Verified | Misleading | False",
                "explanation": "...",
                "reliability_score": 0.0-100.0,
                "sources": ["...", "..."]
            }}
            """
            
            response = self.client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.2
                )
            )
            
            logger.info(f"Fact-check performed for claim: {claim[:50]}...")
            return response.parsed if hasattr(response, 'parsed') else response.text

        except Exception as e:
            logger.error(f"Fact-check failed: {str(e)}")
            return {"error": "Analysis failed", "details": str(e)}

# Singleton instance
fact_check_service = FactCheckService()
