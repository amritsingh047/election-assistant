from fastapi import APIRouter, HTTPException, Depends, File, UploadFile
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
import os
import vertexai.generative_models as generative_models
from services.gemini_service import gemini_service
from services.ocr_service import ocr_service
from services.fact_check_service import fact_check_service
from services.civic_service import civic_service
from services.firestore_service import firestore_service
from services.calendar_service import calendar_service
from services.election_service import election_service
from backend.routes.auth import verify_token
from services.logger import setup_cloud_logger

router = APIRouter()
logger = setup_cloud_logger(__name__)

class ChatRequest(BaseModel):
    message: str = Field(..., max_length=500)
    language: str = Field(default="en", max_length=10)
    state: Optional[str] = Field(default="all", max_length=10)

class SmartChatResponse(BaseModel):
    status: str = "success"
    reply: str
    intent: str = "chat"
    civic_data: Optional[Dict[str, Any]] = None
    calendar_links: Optional[List[Dict[str, Any]]] = None

def get_ai_model():
    return gemini_service.get_model()

SYSTEM_INSTRUCTION: str = """
You are a Smart Election Assistant, a high-trust AI advisor. 
Provide objective, friendly, and localized help based on verified data.

OFFICIAL CONTEXT:
{context}

CITATION RULES (CRITICAL):
1. If you use information from the OFFICIAL CONTEXT, you MUST append "(Source: Official Election Data)" at the end of the relevant sentence.
2. If you use information from Google Search Grounding, you MUST append "(Source: Google Search)" at the end of the relevant sentence.
3. If no specific context is provided, rely on your internal knowledge but clearly state "(Source: General Knowledge)" and clarify it's an estimate.
4. Your priority is to be accurate and secure. If you are unsure, provide links to official state portals.

Respond in language code: {lang}.
"""

async def _internal_get_voter_plan(address: str, current_user: str):
    civic_data = await civic_service.get_voter_info(address)
    state_code = "all"
    if "normalizedInput" in civic_data and "state" in civic_data["normalizedInput"]:
        state_code = civic_data["normalizedInput"]["state"]
    elif "error" not in civic_data and "pollingLocations" in civic_data:
        addr = civic_data["pollingLocations"][0].get("address", {})
        state_code = addr.get("state", "all")

    firestore_service.track_query(user_id=current_user, address=address, success=("error" not in civic_data), features_used=["civic_api"], state=state_code)
    
    if "error" in civic_data:
        civic_data = {"note": "Civic API returned no data. Infer location based on address."}
        
    model = get_ai_model()
    ai_summary = "Here is your voter data."
    if model:
        try:
            prompt = f"""
            Summarize the following raw Civic API data.
            You MUST start your response with this EXACT HTML structure:
            <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #4eacfe;">
                <div style="margin-bottom: 5px;">📍 <strong>Your District:</strong> [District Name]</div>
                <div style="margin-bottom: 5px;">🗳 <strong>Polling Booth:</strong> [Polling Location or 'To be announced']</div>
                <div>📅 <strong>Voting Date:</strong> [Election Date]</div>
            </div>
            Data: {civic_data}
            Address requested: {address}
            """
            resp = model.generate_content(prompt)
            ai_summary = resp.text.strip()
        except Exception as e:
            logger.error(f"Gemini processing failed: {e}")
            
    calendar_links = []
    elec_cal = calendar_service.generate_reminder_card(
        event_title="Election Day 2026",
        event_date="20260512",
        location=civic_data.get("pollingLocations", [{}])[0].get("address", {}).get("locationName", "") if "pollingLocations" in civic_data else "TBD"
    )
    calendar_links.append(elec_cal)
    return ai_summary, civic_data, calendar_links

@router.post("/chat", response_model=SmartChatResponse)
async def chat_with_assistant(req: ChatRequest, current_user: str = Depends(verify_token)) -> SmartChatResponse:
    model = get_ai_model()
    if not model:
        return SmartChatResponse(reply="System: Vertex AI is initializing.")
    
    try:
        # 1. Intent Classification with Fallback
        try:
            classification_prompt = f"Analyze user query: '{req.message}'. If it's a specific address for voting, respond 'VOTER_INFO'. Otherwise respond 'CHAT'. Respond with ONLY the word."
            classification_resp = model.generate_content(classification_prompt)
            intent = classification_resp.text.strip().upper() if classification_resp.text else "CHAT"
        except Exception as e:
            logger.warning(f"Intent classification failed, falling back to CHAT: {e}")
            intent = "CHAT"
        
        if "VOTER_INFO" in intent:
            summary, civic_data, calendar_links = await _internal_get_voter_plan(req.message, current_user)
            return SmartChatResponse(reply=summary, intent="voter_info", civic_data=civic_data, calendar_links=calendar_links)
        
        # 2. General Chat with Context
        context_data = "No specific regional context provided."
        if req.state and req.state != "all":
            try:
                timeline = election_service.get_timeline(req.state)
                context_data = f"Authoritative dates for State {req.state}: Registration: {timeline['registration']}, Early Voting: {timeline['early_voting']}, Election Day: {timeline['election_day']}."
            except Exception:
                context_data = "Regional election dates are currently being updated."
        
        dynamic_system_instruction = SYSTEM_INSTRUCTION.format(lang=req.language, context=context_data)
        
        response = model.generate_content(
            f"{dynamic_system_instruction}\n\nUser: {req.message}",
            generation_config={
                "temperature": 0.2,
                "top_p": 0.8,
                "top_k": 40,
                "max_output_tokens": 1024,
            }
        )
        
        if not response or not response.text:
            logger.warning("AI returned an empty response or was blocked by safety filters.")
            return SmartChatResponse(reply="I'm sorry, I cannot process that request due to safety guidelines or technical limitations. Please try rephrasing.")

        reply_text = response.text.strip()
        
        # Track engagement in Firestore (for dashboard)
        firestore_service.track_chat_query(user_id=current_user, message=req.message, state=req.state)
        
        return SmartChatResponse(reply=reply_text, intent="chat")
            
    except Exception as e:
        logger.error(f"Assistant Critical Error: {str(e)}")
        # Return a user-friendly error instead of 500 where possible
        return SmartChatResponse(
            status="error",
            reply="The Assistant is experiencing high traffic. Please try again in a few moments.",
            intent="error"
        )

@router.post("/upload-id")
async def upload_voter_id(file: UploadFile = File(...), current_user: str = Depends(verify_token)):
    contents = await file.read()
    result = await ocr_service.analyze_voter_id(contents)
    return {"status": "success", "analysis": result}

@router.post("/fact-check")
async def fact_check(req: Dict[str, Any], current_user: str = Depends(verify_token)):
    claim = req.get("claim", "")
    result = await fact_check_service.verify_claim(claim)
    return {"status": "success", "result": result}
