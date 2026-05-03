import urllib.parse
from datetime import datetime, timedelta
from typing import Optional

class CalendarService:
    """
    Generates actionable Google Calendar event URLs based on election dates.
    This provides a zero-auth, highly reliable integration for hackathons.
    """
    
    @staticmethod
    def generate_calendar_link(
        title: str,
        details: str = "",
        location: str = "",
        date_str: Optional[str] = None,  # YYYYMMDD format
        days_before_reminder: int = 1
    ) -> str:
        """
        Creates a pre-filled Google Calendar event URL.
        If date_str is provided (YYYYMMDD), creates a fully dated all-day event.
        Otherwise opens Calendar with just the title/details prefilled.
        """
        base_url = "https://calendar.google.com/calendar/render?action=TEMPLATE"
        
        params = {
            "text": title,
            "details": details,
            "location": location,
        }
        
        # If a date is supplied, add start/end dates and a popup reminder
        if date_str:
            try:
                event_date = datetime.strptime(date_str, "%Y%m%d")
                next_day = event_date + timedelta(days=1)
                params["dates"] = f"{event_date.strftime('%Y%m%d')}/{next_day.strftime('%Y%m%d')}"
            except ValueError:
                pass  # Invalid format – skip dates, let user pick in Calendar UI
        
        query_string = urllib.parse.urlencode(params)
        return f"{base_url}&{query_string}"

    @staticmethod
    def generate_reminder_card(event_title: str, event_date: str, location: str = "") -> dict:
        """
        Returns a structured reminder card dict for the frontend to render.
        event_date should be YYYYMMDD, e.g. '20261201'
        """
        try:
            dt = datetime.strptime(event_date, "%Y%m%d")
            display_date = dt.strftime("%d %B %Y")  # e.g. "12 May 2026"
        except ValueError:
            display_date = event_date
        
        calendar_url = CalendarService.generate_calendar_link(
            title=event_title,
            details=f"Reminder: {event_title} on {display_date}. Set up by Smart Election Assistant.",
            location=location,
            date_str=event_date,
            days_before_reminder=1
        )
        
        return {
            "title": event_title,
            "display_date": display_date,
            "calendar_url": calendar_url,
            "reminder_note": "1 day before"
        }

calendar_service = CalendarService()
