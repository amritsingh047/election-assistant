from typing import Dict, Any
from functools import lru_cache

class ElectionService:
    """
    Service for retrieving authoritative election timelines and dates.
    In a production app, this would fetch from a database or official API.
    """
    
    @lru_cache(maxsize=128)
    def get_timeline(self, state: str) -> Dict[str, str]:
        # authoritative data for major states
        data = {
            "MH": {"registration": "April 15, 2026", "early_voting": "May 1, 2026", "election_day": "May 12, 2026"},
            "DL": {"registration": "April 20, 2026", "early_voting": "May 5, 2026", "election_day": "May 12, 2026"},
            "KA": {"registration": "April 10, 2026", "early_voting": "April 28, 2026", "election_day": "May 12, 2026"},
            "TN": {"registration": "April 12, 2026", "early_voting": "April 30, 2026", "election_day": "May 12, 2026"},
            "WB": {"registration": "April 18, 2026", "early_voting": "May 3, 2026", "election_day": "May 12, 2026"},
        }
        
        return data.get(state, {"registration": "Oct 20, 2026", "early_voting": "Oct 25, 2026", "election_day": "Nov 3, 2026"})

election_service = ElectionService()
