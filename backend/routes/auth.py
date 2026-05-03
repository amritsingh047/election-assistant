from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
import jwt
import firebase_admin
from firebase_admin import auth, credentials

from backend.config import settings

router = APIRouter()

# Initialize Firebase Admin if not already initialized
try:
    firebase_admin.get_app()
except ValueError:
    # Use default credentials (Service Account) in production
    firebase_admin.initialize_app()

# --- Config for JWT using Centralized Settings ---
SECRET_KEY: str = settings.SECRET_KEY
ALGORITHM: str = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES: int = settings.ACCESS_TOKEN_EXPIRE_MINUTES

# --- Mock Database ---
MOCK_USER: Dict[str, str] = {
    "username": "voter",
    "password": "password123"
}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

class Token(BaseModel):
    """Token response model."""
    access_token: str = Field(..., description="The JWT or Firebase access token string")
    token_type: str = Field(..., description="The type of the token (e.g., bearer)")

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Creates a new JSON Web Token for legacy authentication.

    Args:
        data (Dict[str, Any]): The payload to encode in the token.
        expires_delta (Optional[timedelta]): Optional expiration time.

    Returns:
        str: The encoded JWT string.
    """
    to_encode: Dict[str, Any] = data.copy()
    if expires_delta:
        expire: datetime = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt: str = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def verify_token(token: str = Depends(oauth2_scheme)) -> str:
    """
    Verifies the provided token (Supports both Legacy JWT and Firebase ID Tokens).
    
    Args:
        token (str): The token extracted from the Authorization header.

    Returns:
        str: The authenticated username or email.

    Raises:
        HTTPException: If the token is invalid or expired.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 1. Try Firebase Token Verification first (Modern Standard)
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token.get("email") or decoded_token.get("uid")
    except Exception:
        # Not a valid Firebase token, fallback to legacy JWT
        pass

    # 2. Try Legacy JWT Verification
    try:
        payload: Dict[str, Any] = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return username
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

@router.post("/login", response_model=Token, summary="Authenticate user", description="Authenticates a user via OAuth2 password flow and returns a JWT token.")
async def login(form_data: OAuth2PasswordRequestForm = Depends()) -> Dict[str, str]:
    """
    Authenticate a user using username and password.

    Args:
        form_data (OAuth2PasswordRequestForm): Form containing username and password.

    Returns:
        Dict[str, str]: A dictionary containing the access token and token type.
        
    Raises:
        HTTPException: If credentials are incorrect.
    """
    if form_data.username != MOCK_USER["username"] or form_data.password != MOCK_USER["password"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires: timedelta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token: str = create_access_token(
        data={"sub": form_data.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}
