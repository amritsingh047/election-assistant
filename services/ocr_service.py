import os
from typing import Dict, Any
from google.genai import types
from services.gemini_service import gemini_service
from services.logger import setup_cloud_logger

logger = setup_cloud_logger(__name__)

class OCRService:
    def __init__(self):
        self.client = gemini_service.get_client()

    async def analyze_voter_id(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Uses Gemini Vision to extract details from a Voter ID card.
        This is a mock-safe demonstration of AI-driven registration verification.
        """
        if not self.client:
            logger.warning("OCR requested but Gemini client is not initialized.")
            return {"error": "AI Service unavailable", "details": "Check API Key"}

        try:
            prompt = """
            Extract the following information from this Voter ID card:
            1. Full Name
            2. Voter ID Number
            3. State/Region
            4. Expiry Date (if any)
            5. Verification Status (Check if it looks like a valid ID)

            Respond ONLY in JSON format:
            {
                "name": "...",
                "id_number": "...",
                "state": "...",
                "expiry": "...",
                "is_valid_format": true/false,
                "confidence_score": 0.0-1.0
            }
            """
            
            # Using Gemini 1.5 Flash for multimodal OCR with correct config type
            response = self.client.models.generate_content(
                model="gemini-1.5-flash",
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"),
                    prompt
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1
                )
            )
            
            logger.info("Successfully analyzed Voter ID document.")
            return response.parsed if hasattr(response, 'parsed') else response.text
            
        except Exception as e:
            logger.error(f"OCR Analysis failed: {str(e)}")
            return {"error": "Analysis failed", "details": str(e)}

# Singleton instance
ocr_service = OCRService()
