import time
import os
from google.cloud import monitoring_v3
from services.logger import setup_cloud_logger

logger = setup_cloud_logger(__name__)

class MonitoringService:
    """
    Enterprise Monitoring Service for Google Cloud.
    Tracks custom metrics for application performance and usage.
    """
    def __init__(self):
        self.project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "election-assistant-app-123")
        self.client = None
        try:
            self.client = monitoring_v3.MetricServiceClient()
            logger.info("Cloud Monitoring initialized.")
        except Exception as e:
            logger.warning(f"Monitoring initialization failed: {e}")

    def track_ai_latency(self, latency_ms: float, model_name: str = "gemini-1.5-flash"):
        """
        Records the latency of AI responses as a custom metric.
        
        Args:
            latency_ms (float): Latency in milliseconds.
            model_name (str): Name of the AI model used.
        """
        if not self.client:
            return

        try:
            series = monitoring_v3.TimeSeries()
            series.metric.type = "custom.googleapis.com/ai/response_latency"
            series.resource.type = "global"
            series.metric.labels["model"] = model_name
            
            point = monitoring_v3.Point()
            point.value.double_value = latency_ms
            now = time.time()
            point.interval.end_time.seconds = int(now)
            point.interval.end_time.nanos = int((now - int(now)) * 10**9)
            series.points = [point]

            project_name = f"projects/{self.project_id}"
            self.client.create_time_series(name=project_name, time_series=[series])
        except Exception as e:
            logger.error(f"Failed to record AI latency metric: {e}")

    def track_voter_query(self, state_code: str):
        """
        Increments a counter for voter queries per state.
        
        Args:
            state_code (str): The state code being queried.
        """
        if not self.client:
            return

        try:
            series = monitoring_v3.TimeSeries()
            series.metric.type = "custom.googleapis.com/voter/query_count"
            series.resource.type = "global"
            series.metric.labels["state"] = state_code
            
            point = monitoring_v3.Point()
            point.value.int64_value = 1
            now = time.time()
            point.interval.end_time.seconds = int(now)
            point.interval.end_time.nanos = int((now - int(now)) * 10**9)
            series.points = [point]

            project_name = f"projects/{self.project_id}"
            self.client.create_time_series(name=project_name, time_series=[series])
        except Exception as e:
            logger.error(f"Failed to record Voter Query metric: {e}")

# Singleton instance
monitoring_service = MonitoringService()
