import os
from google import genai

class GeminiService:
    def __init__(self):
        self.client = None
        self._initialize()
        
    def _initialize(self):
        try:
            api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
            if api_key and api_key != "your_api_key_here":
                self.client = genai.Client(api_key=api_key)
        except Exception as e:
            print(f"Failed to initialize GeminiService: {e}")

    def get_client(self):
        return self.client

# Singleton instance
gemini_service = GeminiService()
