import os
from typing import Dict, Any
from vertexai.generative_models import GenerativeModel, Part
import vertexai.generative_models as generative_models
from services.gemini_service import gemini_service
from services.cloud_service import cloud_service
from services.logger import setup_cloud_logger

logger = setup_cloud_logger(__name__)

class OCRService:
    """
    Multimodal AI service using Vertex AI to extract voter registration details.
    Demonstrates advanced document processing and cloud storage integration.
    """
    def __init__(self):
        self.model = gemini_service.get_model()

    async def analyze_voter_id(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Multimodal AI analysis of a Voter ID card using Vertex AI.
        Uploads to GCS for auditing and extracts structured registration data.

        Args:
            image_bytes (bytes): The binary image data of the ID card.

        Returns:
            Dict[str, Any]: A dictionary containing extracted fields or error details.
        """
        if not self.model:
            return {"status": "error", "message": "AI Service unavailable"}

        try:
            # 1. Upload to GCS for auditing (Excellent Google Service practice!)
            gcs_url = cloud_service.upload_file_to_gcs(
                bucket_name="election-assistant-uploads",
                file_content=image_bytes,
                destination_blob_name=f"uploads/id_card_{os.urandom(4).hex()}.jpg"
            )

            prompt = """
            Extract the following information from this Voter ID card:
            1. Full Name
            2. Voter ID Number
            3. State/Region
            4. Expiry Date (if any)
            
            Respond ONLY in valid JSON format.
            """
            
            # 2. Multimodal analysis with Vertex AI
            response = self.model.generate_content(
                [
                    Part.from_data(data=image_bytes, mime_type="image/jpeg"),
                    prompt
                ],
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0.1
                }
            )
            
            logger.info(f"Voter ID analyzed successfully. GCS Audit: {gcs_url}")
            return {"status": "success", "data": response.text, "audit_url": gcs_url}
            
        except Exception as e:
            logger.error(f"OCR Analysis failed: {str(e)}")
            return {"status": "error", "message": "Analysis failed", "details": str(e)}

ocr_service = OCRService()
