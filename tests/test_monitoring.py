import pytest
from unittest.mock import MagicMock, patch
from services.monitoring_service import MonitoringService

@pytest.fixture
def mock_monitoring_client():
    with patch("google.cloud.monitoring_v3.MetricServiceClient") as mock_client:
        yield mock_client

def test_monitoring_service_initialization(mock_monitoring_client):
    service = MonitoringService()
    assert service.client is not None
    mock_monitoring_client.assert_called_once()

def test_track_ai_latency(mock_monitoring_client):
    service = MonitoringService()
    service.track_ai_latency(150.5, "gemini-1.5-flash")
    
    # Verify create_time_series was called
    assert service.client.create_time_series.called
    args, kwargs = service.client.create_time_series.call_args
    assert "time_series" in kwargs
    ts = kwargs["time_series"][0]
    assert ts.metric.type == "custom.googleapis.com/ai/response_latency"
    assert ts.metric.labels["model"] == "gemini-1.5-flash"
    assert ts.points[0].value.double_value == 150.5

def test_track_voter_query(mock_monitoring_client):
    service = MonitoringService()
    service.track_voter_query("MH")
    
    assert service.client.create_time_series.called
    ts = service.client.create_time_series.call_args.kwargs["time_series"][0]
    assert ts.metric.type == "custom.googleapis.com/voter/query_count"
    assert ts.metric.labels["state"] == "MH"
    assert ts.points[0].value.int64_value == 1
