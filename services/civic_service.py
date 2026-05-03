import httpx
from typing import Dict, Any
from backend.config import settings
from services.logger import setup_cloud_logger

logger = setup_cloud_logger(__name__)

class CivicService:
    """
    Integrates with the Google Civic Information API to retrieve official election data.
    """
    def __init__(self):
        self.api_key = settings.GOOGLE_API_KEY
        self.base_url = "https://www.googleapis.com/civicinfo/v2"
        
    async def get_voter_info(self, address: str) -> Dict[str, Any]:
        """
        Fetches voter info (polling locations, early voting, etc.) for a specific address.
        """
        if not self.api_key:
            logger.warning("GOOGLE_API_KEY is not set. Returning mock civic data.")
            return self._get_mock_data(address)
            
        try:
            async with httpx.AsyncClient() as client:
                # electionId=2000 is the VIP Test Election
                url = f"{self.base_url}/voterinfo"
                params = {
                    "address": address,
                    "electionId": 2000, 
                    "key": self.api_key
                }
                response = await client.get(url, params=params)
                
                if response.status_code == 200:
                    return response.json()
                else:
                    logger.error(f"Civic API error {response.status_code}: {response.text}")
                    return {"error": f"Civic API returned {response.status_code}"}
                    
        except Exception as e:
            logger.error(f"Civic API Request Failed: {e}")
            return {"error": "Failed to connect to Civic Information API"}

    def _get_mock_data(self, address: str) -> Dict[str, Any]:
        """Mock data for demo purposes when API key is missing."""
        return {
            "normalizedInput": {
                "line1": address,
                "city": "Sample City",
                "state": "CA",
                "zip": "90210"
            },
            "pollingLocations": [
                {
                    "address": {
                        "locationName": "Community Center",
                        "line1": "123 Civic Way",
                        "city": "Sample City",
                        "state": "CA",
                        "zip": "90210"
                    },
                    "pollingHours": "7:00 AM - 8:00 PM"
                }
            ],
            "state": [
                {
                    "name": "California",
                    "electionAdministrationBody": {
                        "name": "California Secretary of State",
                        "electionInfoUrl": "https://www.sos.ca.gov/elections",
                        "votingLocationFinderUrl": "https://www.sos.ca.gov/elections/polling-place"
                    }
                }
            ]
        }

civic_service = CivicService()
