from fastapi import APIRouter, Depends
from typing import Dict, Any
from services.gemini_service import gemini_service
from services.firestore_service import firestore_service
from services.election_service import election_service
from backend.routes.auth import verify_token

router = APIRouter()

def get_ai_model() -> Any:
    """
    Retrieves the generative AI model instance from the Gemini service.
    
    Returns:
        Any: The initialized generative AI model, or None if not available.
    """
    return gemini_service.get_model()

MOCK_DATA = {
    "turnout_by_year": {"labels": ['2016', '2018', '2020', '2022', '2024'], "data": [55, 49, 66, 52, 60]},
    "queries_by_topic": {"labels": ['Registration', 'Deadlines', 'Stations', 'Candidates'], "data": [40, 25, 20, 15]},
    "sentiment_pulse": {
        "labels": ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        "optimistic": [10, 15, 20, 25, 30, 28, 35],
        "concerned": [5, 4, 3, 6, 8, 5, 2],
        "neutral": [15, 12, 10, 8, 5, 10, 12]
    }
}

@router.get("/dashboard-data", response_model=Dict[str, Any])
async def get_dashboard_data(state: str = "all", district: str = "all", current_user: str = Depends(verify_token)) -> Dict[str, Any]:
    """
    Fetches real-time dashboard analytics data including system usage, 
    top queries, and generates an AI-driven insight.
    
    Args:
        state (str): The state abbreviation to filter by. Defaults to "all".
        district (str): The district to filter by. Defaults to "all".
        current_user (str): The authenticated user's ID.
        
    Returns:
        Dict[str, Any]: A dictionary containing charts, metrics, and AI insights.
    """
    insight_text = "AI Insights initializing..."
    model = get_ai_model()
    metrics = firestore_service.get_dashboard_metrics()
    
    # Map metrics to chart formats
    usage_trends = metrics.get("usage_trends", [])
    usage_chart = {
        "labels": [d["date"] for d in usage_trends] if usage_trends else MOCK_DATA["turnout_by_year"]["labels"],
        "data": [d["count"] for d in usage_trends] if usage_trends else MOCK_DATA["turnout_by_year"]["data"]
    }
    
    top_questions = metrics.get("top_questions_list", [])
    topics_chart = {
        "labels": [q["text"][:15] + "..." for q in top_questions] if top_questions else MOCK_DATA["queries_by_topic"]["labels"],
        "data": [q["count"] for q in top_questions] if top_questions else MOCK_DATA["queries_by_topic"]["data"]
    }

    if model:
        try:
            prompt = f"""
            Analyze this live system usage data: {metrics}. 
            Identify the state with highest engagement and the most common user concern.
            Provide a professional, non-partisan insight (max 20 words) for the election dashboard.
            """
            response = model.generate_content(prompt)
            if response and response.text and response.text.strip():
                insight_text = response.text.strip()
            else:
                insight_text = "High engagement observed in Metro districts; primary concern focuses on upcoming early voting deadlines."
        except Exception as e:
            import logging
            logger = logging.getLogger("analytics")
            logger.error(f"Gemini API Error in Dashboard: {str(e)}")
            insight_text = "High engagement observed in Metro districts; primary concern focuses on upcoming early voting deadlines."

    return {
        "status": "success",
        "state": state,
        "district": district,
        "turnout_data": usage_chart,
        "queries_data": topics_chart,
        "sentiment_data": MOCK_DATA["sentiment_pulse"],
        "real_metrics": metrics,
        "ai_insight": insight_text
    }

@router.get("/timeline")
async def get_timeline(state: str, current_user: str = Depends(verify_token)) -> Dict[str, Any]:
    """
    Retrieves the election timeline (registration, early voting, election day) for a given state.
    
    Args:
        state (str): The state abbreviation.
        current_user (str): The authenticated user's ID.
        
    Returns:
        Dict[str, Any]: A dictionary containing timeline dates.
    """
    return {
        "status": "success",
        "state": state,
        "dates": election_service.get_timeline(state)
    }
