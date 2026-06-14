import os
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow

# CRITICAL: This explicitly tells Google to allow OAuth over standard HTTP for localhost development.
# Without this, the flow will violently crash requiring HTTPS.
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"

CLIENT_SECRETS_FILE = "client_secrets.json"
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]
import hashlib
import uuid
from pydantic import BaseModel

class JobTicket(BaseModel):
    video_key: str
    title: str
from worker import simulate_youtube_upload, celery_app
from typing import List
from worker import simulate_youtube_upload

# CRITICAL: Load environment variables FIRST before anything else!
from dotenv import load_dotenv
load_dotenv()

import boto3
from botocore.client import Config

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# Importing custom structural layers
from database import engine, SessionLocal, Base
import models
import schemas
import auth

# 1. INITIALIZE FASTAPI (Only Once) ---
app = FastAPI()

# 2. ACTIVATE THE GUEST LIST (CORS) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://data-vault--adityayadav7459.replit.app",
        "https://data-vault--adityayadav7459.replit.app/",
        "http://localhost:3000",
        "http://localhost:5173",    # <-- ADDED LOCAL VITE PORT
        "http://127.0.0.1:5173",
        "http://40.80.89.198:8000",
        "http://40.80.89.198",   # <-- ADDED THE IP EQUIVALENT
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security_lock = HTTPBearer()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def home():
    return {"message": "Welcome to EJ_Ent's Live API Backend!"}

# --- ACCOUNT OPERATIONS ---
@app.post("/register", status_code=status.HTTP_201_CREATED)
def register_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    existing_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    
    hashed_password = hashlib.sha256(user_data.password.encode()).hexdigest()
    new_user = models.User(email=user_data.email, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully!", "user_id": str(new_user.id)}

@app.post("/login")
def login_user(login_data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == login_data.email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Email or Password")
        
    input_password_hash = hashlib.sha256(login_data.password.encode()).hexdigest()
    if input_password_hash != user.password_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Email or Password")
        
    token_payload = {"user_id": str(user.id), "email": user.email}
    access_token = auth.create_access_token(data=token_payload)
    
    return {"message": "Login successful!", "access_token": access_token, "token_type": "bearer"}

@app.get("/users/me")
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_lock), db: Session = Depends(get_db)):
    token_data = auth.verify_access_token(credentials.credentials)
    user = db.query(models.User).filter(models.User.id == token_data.get("user_id")).first()
    if not user:
        raise HTTPException(status_code=404, detail="User profile not found.")
    return {"status": "Authorized Access Granted", "profile": {"id": user.id, "email": user.email, "tier": user.tier, "created_at": user.created_at}}


# --- NEW PHASE 3: CORE PROTECTED RECORD DOORS ---

# Door 1: Created a new record stamped with the logged-in user's tag
@app.post("/records", response_model=schemas.RecordResponse, status_code=status.HTTP_201_CREATED)
def create_new_record(
    record_input: schemas.RecordCreate,
    credentials: HTTPAuthorizationCredentials = Depends(security_lock),
    db: Session = Depends(get_db)
):
    token_data = auth.verify_access_token(credentials.credentials)
    current_user_id = token_data.get("user_id")
    
    new_record = models.Record(
        title=record_input.title,
        description=record_input.description,
        user_id=uuid.UUID(current_user_id) 
    )
    
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    
    return new_record

# Door 2: Fetch only the records that belong to THIS specific user
@app.get("/records", response_model=List[schemas.RecordResponse])
def get_my_records(
    credentials: HTTPAuthorizationCredentials = Depends(security_lock),
    db: Session = Depends(get_db)
):
    token_data = auth.verify_access_token(credentials.credentials)
    current_user_id = token_data.get("user_id")
    
    user_records = db.query(models.Record).filter(
        models.Record.user_id == uuid.UUID(current_user_id) 
    ).all()
    
    return user_records

# Door 3: Fetch ONE specific record by its ID safely
@app.get("/records/{record_id}", response_model=schemas.RecordResponse)
def get_single_record(
    record_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security_lock),
    db: Session = Depends(get_db)
):
    token_data = auth.verify_access_token(credentials.credentials)
    current_user_id = token_data.get("user_id")
    
    record = db.query(models.Record).filter(models.Record.id == record_id).first()
    
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Record with ID {record_id} does not exist."
        )
        
    if str(record.user_id) != str(current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You do not own this data record."
        )
        
    return record

# Door 4: Delete a specific record cleanly and securely
@app.delete("/records/{record_id}", status_code=status.HTTP_200_OK)
def delete_record(
    record_id: int,
    credentials: HTTPAuthorizationCredentials = Depends(security_lock),
    db: Session = Depends(get_db)
):
    token_data = auth.verify_access_token(credentials.credentials)
    current_user_id = token_data.get("user_id")
    
    record = db.query(models.Record).filter(models.Record.id == record_id).first()
    
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Record with ID {record_id} does not exist."
        )
        
    if str(record.user_id) != str(current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You do not have permission to delete this record."
        )
        
    db.delete(record)
    db.commit()
    
    return {"message": f"Record with ID {record_id} has been permanently deleted."}

# Door 5: Modify an existing record securely
@app.put("/records/{record_id}", response_model=schemas.RecordResponse)
def update_record(
    record_id: int,
    record_update: schemas.RecordUpdate,
    credentials: HTTPAuthorizationCredentials = Depends(security_lock),
    db: Session = Depends(get_db)
):
    token_data = auth.verify_access_token(credentials.credentials)
    current_user_id = token_data.get("user_id")
    
    record = db.query(models.Record).filter(models.Record.id == record_id).first()
    
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Record with ID {record_id} does not exist."
        )
        
    if str(record.user_id) != str(current_user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You do not have permission to modify this record."
        )
        
    record.title = record_update.title
    record.description = record_update.description
    
    db.commit()
    db.refresh(record)
    
    return record

# --- PHASE 2: DIRECT-TO-CLOUD UPLOAD PIPELINE ---

@app.post("/generate-upload-url")
def generate_presigned_url(
    file_name: str, 
    file_type: str, 
    credentials: HTTPAuthorizationCredentials = Depends(security_lock)
):
    # 1. Verify the user is logged in
    auth.verify_access_token(credentials.credentials)
    
    # 2. Safely fetch environment variables
    storage_endpoint = os.getenv("STORAGE_ENDPOINT")
    storage_access_key = os.getenv("STORAGE_ACCESS_KEY")
    storage_secret_key = os.getenv("STORAGE_SECRET_KEY")
    bucket_name = os.getenv("STORAGE_BUCKET_NAME")

    # 3. Defensive Check
    if not all([storage_endpoint, storage_access_key, storage_secret_key, bucket_name]):
        raise HTTPException(status_code=500, detail="Server Storage Configuration is missing in .env")

    # THE SPLIT-BRAIN ROUTER FIX:
    # We forcefully translate the internal Docker 'minio' domain into your public 
    # Azure IP, and strip the port. This guarantees the cryptographic math 
    # perfectly aligns with the Nginx proxy, regardless of what the .env says.
    public_gateway_url = storage_endpoint.replace("minio", "40.80.89.198").replace(":9000", "")

    # 4. Configure the boto3 client
    s3_client = boto3.client(
        's3',
        endpoint_url=public_gateway_url, # <-- Mathematically locked to the public IP
        aws_access_key_id=storage_access_key,
        aws_secret_access_key=storage_secret_key,
        config=Config(
            signature_version='s3v4',
            s3={'addressing_style': 'path'}
        ),
        region_name='us-east-1'
    )
    
    # 5. Generate a unique, safe file name 
    unique_file_name = f"{uuid.uuid4()}-{file_name}"
    
    # 6. Ask MinIO for a temporary URL that allows a PUT request
    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
                'Key': unique_file_name,
                'ContentType': file_type
            },
            ExpiresIn=3600 # The URL expires in 1 hour
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not generate URL: {str(e)}")
        
    return {
        "upload_url": presigned_url,
        "file_key": unique_file_name
    }

# --- PHASE 3: AUTOMATION ENGINE ROUTES ---

from pydantic import BaseModel

class JobTicket(BaseModel):
    video_key: str
    title: str

@app.post("/test-background-upload")
def test_automation_engine(ticket: JobTicket, credentials: HTTPAuthorizationCredentials = Depends(security_lock)):
    # 1. Verify user AND extract their unique ID
    token_data = auth.verify_access_token(credentials.credentials)
    current_user_id = token_data.get("user_id")
    
    # 2. THE CRITICAL FIX: Pass current_user_id to the Celery worker!
    task = simulate_youtube_upload.delay(ticket.video_key, ticket.title, current_user_id)
    
    # 3. Respond instantly
    return {
        "message": "Job ticket sent to Redis!",
        "task_id": task.id
    }

# --- PHASE 3: AUTOMATION STATUS ---

@app.get("/task-status/{task_id}")
def get_task_status(task_id: str, credentials: HTTPAuthorizationCredentials = Depends(security_lock)):
    # 1. Verify user
    auth.verify_access_token(credentials.credentials)
    
    # 2. Looking up the specific job ticket in the Redis cloud
    task = celery_app.AsyncResult(task_id)
    
    # 3. Translate the Celery state into a React-friendly response
    if task.state == 'PROGRESS':
        return {"status": "PROGRESS", "progress": task.info.get('progress', 0)}
    elif task.state == 'SUCCESS':
        return {"status": "SUCCESS", "progress": 100}
    elif task.state == 'FAILURE':
        return {"status": "FAILURE", "progress": 0}
        
    # Default for PENDING or STARTED
    return {"status": task.state, "progress": 0}


# --- PHASE 4: GOOGLE OAUTH2 HANDSHAKE ---

import secrets
import redis
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow

# 1. Connect to the Redis "Clipboard"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)

# Fetch dynamic URLs for routing
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

@app.get("/auth/youtube/login")
def youtube_login(credentials: HTTPAuthorizationCredentials = Depends(security_lock)):
    # Verify the user requesting the login is actually logged into our app
    auth_payload = auth.verify_access_token(credentials.credentials)
    user_id = auth_payload.get("user_id")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="You must be logged in to connect YouTube.")

    # Build the Google handshake engine
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=f"{BACKEND_URL}/auth/callback"
    )
    
    # Generate the secure Google URL and the random "coat check ticket" (state)
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'
    )
    
    # Save the ticket to Redis. Link it to the User ID. Expire in 600 seconds (10 mins).
    redis_client.setex(f"oauth_state:{state}", 600, str(user_id))
    
    return RedirectResponse(url=authorization_url)


@app.get("/auth/callback")
def youtube_callback(request: Request, db: Session = Depends(get_db)):
    # 1. Catch the ticket (state) and approval code returned by Google
    state = request.query_params.get("state")
    code = request.query_params.get("code")
    
    if not state or not code:
        raise HTTPException(status_code=400, detail="Missing critical OAuth parameters from Google.")
        
    # 2. Check the Redis clipboard for the ticket
    user_id = redis_client.get(f"oauth_state:{state}")
    if not user_id:
        raise HTTPException(status_code=400, detail="Login expired or invalid. Please try again.")
        
    # 3. Burn the ticket immediately so it can never be used again
    redis_client.delete(f"oauth_state:{state}")
        
    # 4. Rebuild the handshake engine using the verified ticket
    flow = Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=f"{BACKEND_URL}/auth/callback",
        state=state
    )
    
    # 5. Mint the final access keys
    flow.fetch_token(code=code)
    credentials = flow.credentials
    
    refresh_token = credentials.refresh_token
    access_token = credentials.token
    
    if not refresh_token:
        # If Google doesn't send a refresh token, the user needs to revoke app access in their Google settings and retry
        return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?youtube_connected=error_no_refresh")

    # --- SUCCESS ---
    # We use your dedicated ConnectedAccount table instead of crowding the User table!
    existing_account = db.query(models.ConnectedAccount).filter(
        models.ConnectedAccount.user_id == user_id,
        models.ConnectedAccount.platform == "youtube"
    ).first()

    if existing_account:
        existing_account.refresh_token = refresh_token
        existing_account.access_token = access_token
    else:
        new_account = models.ConnectedAccount(
            platform="youtube",
            access_token=access_token,
            refresh_token=refresh_token,
            user_id=user_id
        )
        db.add(new_account)

    db.commit()

    return RedirectResponse(url=f"{FRONTEND_URL}/dashboard?youtube_connected=true")