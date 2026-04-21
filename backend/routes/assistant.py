from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
import os
from google.genai import types
from services.gemini_service import gemini_service
from backend.routes.auth import verify_token
from services.logger import setup_cloud_logger

router = APIRouter()
logger = setup_cloud_logger(__name__)

class ChatRequest(BaseModel):
    """Secure request model with input validation to prevent injection."""
    message: str = Field(..., max_length=500, description="The user's query")
    language: str = Field(default="en", max_length=10, pattern="^[a-zA-Z-]+$")

class ChatResponse(BaseModel):
    """Response model for the chatbot."""
    reply: str = Field(..., description="The AI assistant's response")

# Initialize the Gemini Client from Modular Service
client = gemini_service.get_client()

SYSTEM_INSTRUCTION: str = """
You are a Smart Election Assistant. Your goal is to help citizens understand the election process,
timelines, and registration steps in an interactive and easy-to-follow way.
Keep your answers concise, objective, and friendly. Do not hallucinate election dates; 
if you do not know a specific local date, advise the user to check their local election office.
You must respond in the following language code: {lang}
"""

@router.post(
    "/chat", 
    response_model=ChatResponse, 
    summary="Chat with AI Assistant", 
    description="Sends a user query to the Gemini AI and returns a localized response. Requires authentication."
)
async def chat_with_assistant(req: ChatRequest, current_user: str = Depends(verify_token)) -> ChatResponse:
    """
    Processes a chat message using the Gemini AI API.

    Args:
        req (ChatRequest): The chat request containing message and language preference.
        current_user (str): The authenticated user's username.

    Returns:
        ChatResponse: The AI generated reply.

    Raises:
        HTTPException: If the AI generation fails.
    """
    if not client:
        logger.warning("Chat endpoint called, but Gemini API key is missing. Returning mock.")
        return ChatResponse(reply="System: Gemini API key is not configured yet. This is a mock response: " + req.message)
    
    try:
        logger.info(f"Processing chat request for user {current_user}", extra_args={"language": req.language})
        
        # We use the gemini-2.5-flash model for fast, efficient chat
        dynamic_system_instruction: str = SYSTEM_INSTRUCTION.replace("{lang}", req.language)
        
        # Apply strict Safety Settings for enterprise deployment
        safety_settings = [
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold=types.HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=types.HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
            )
        ]

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=req.message,
            config=types.GenerateContentConfig(
                system_instruction=dynamic_system_instruction,
                temperature=0.3, # Keep it relatively deterministic for election facts
                safety_settings=safety_settings
            )
        )
        logger.info("Successfully generated AI response.")
        return ChatResponse(reply=response.text)
    except Exception as e:
        logger.error(f"Error during Gemini generation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
