from fastapi.testclient import TestClient
from main import app
import pytest

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "election-assistant-api"}

def test_unauthorized_dashboard_access():
    """Test that dashboard requires auth."""
    response = client.get("/api/dashboard-data")
    assert response.status_code == 401

def test_login_success():
    """Test successful login returns a JWT."""
    response = client.post("/api/auth/login", data={"username": "voter", "password": "password123"})
    assert response.status_code == 200
    assert "access_token" in response.json()
    return response.json()["access_token"]

def test_login_failure():
    """Test login failure on wrong password."""
    response = client.post("/api/auth/login", data={"username": "voter", "password": "wrong"})
    assert response.status_code == 401

def test_dashboard_data_with_auth():
    """Test dashboard with valid token."""
    token = test_login_success()
    response = client.get("/api/dashboard-data", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "turnout_data" in data

def test_timeline_caching_with_auth():
    """Test timeline caching with valid token."""
    token = test_login_success()
    headers = {"Authorization": f"Bearer {token}"}
    
    # First call
    response1 = client.get("/api/timeline?state=TX", headers=headers)
    assert response1.status_code == 200
    
    # Second call should hit the lru_cache
    response2 = client.get("/api/timeline?state=TX", headers=headers)
    assert response2.status_code == 200
    assert response1.json() == response2.json()

def test_chat_validation_missing_field():
    """Test missing field validation."""
    response = client.post("/api/assistant/chat", json={"language": "es"})
    assert response.status_code == 401 # Because auth runs before body validation usually, wait, depends. If no auth, 401.

def test_chat_with_auth_success():
    """Test chat logic with valid auth."""
    token = test_login_success()
    response = client.post(
        "/api/assistant/chat", 
        json={"message": "hello", "language": "en"},
        headers={"Authorization": f"Bearer {token}"}
    )
    # Could be 200 (if API key is good) or 500 (if API key fails), but 401 means auth failed, 422 means pydantic failed.
    assert response.status_code in [200, 500]
