import jwt
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv
from fastapi import HTTPException, status

# Load our secret key from the hidden .env file
load_dotenv()
SECRET_KEY = os.getenv("SECRET_KEY", "fallback_secret_for_safety")
ALGORITHM = "HS256" # The industry-standard signature blueprint

# Job 1: Print a fresh keycard that expires in 30 minutes
def create_access_token(data: dict):
    to_encode = data.copy()
    
    # Modern Python 3.13 practice: Use explicit timezone-aware UTC timestamps
    expire = datetime.now(timezone.utc) + timedelta(minutes=30)
    
    # Add the expiration timestamp into the token payload
    to_encode.update({"exp": expire})
    
    # Mix the data, secret key, and algorithm together to sign the token
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# Job 2: Check if a swiped keycard is authentic or expired
def verify_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload # Returns the user data hidden inside the token
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your keycard has expired. Please login again."
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid keycard token."
        )