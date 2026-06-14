import os
import ssl
import json
import boto3
import uuid
from celery import Celery
from dotenv import load_dotenv
from database import SessionLocal
import models

# GOOGLE API ENGINES ---
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

# 1. Load Environment Variables
load_dotenv()
redis_url = os.getenv("REDIS_URL")

# 2. Initialize Celery Engine
celery_app = Celery("ej_ent_worker", broker=redis_url, backend=redis_url)
celery_app.conf.update(
    broker_use_ssl={'ssl_cert_reqs': ssl.CERT_NONE},
    redis_backend_use_ssl={'ssl_cert_reqs': ssl.CERT_NONE}
)

# 3. Initialize MinIO Storage Vault
MINIO_BUCKET = os.getenv("MINIO_BUCKET_NAME", "ej-ent-videos")
s3_client = boto3.client(
    's3',
    endpoint_url="http://minio:9000",
    aws_access_key_id=os.getenv("STORAGE_ACCESS_KEY", "minioadmin"),
    aws_secret_access_key=os.getenv("STORAGE_SECRET_KEY", "minioadmin"),
    region_name="us-east-1"
)

@celery_app.task(bind=True, max_retries=3)
def simulate_youtube_upload(self, video_file_key: str, post_title: str, user_id: str):
    print(f"\n[{video_file_key}] INITIATING FULL YOUTUBE PIPELINE...")
    self.update_state(state='PROGRESS', meta={'progress': 10})

    # 1. Open a database connection inside the worker
    db = SessionLocal()
    
    # 2. Cast the string user_id to a native UUID object
    account = db.query(models.ConnectedAccount).filter(
        models.ConnectedAccount.user_id == uuid.UUID(user_id),
        models.ConnectedAccount.platform == "youtube"
    ).first()
    
    # 3. Extract THEIR specific token
    user_token = account.refresh_token if account else None
    db.close()
    
    # CRITICAL FIX 1: Guard against missing tokens
    if not user_token:
        self.update_state(state='FAILURE', meta={'progress': 0})
        return {"status": "FAILURE", "error": "User has not connected their YouTube account."}
        
    # CRITICAL FIX 2: Use /tmp/ directory to avoid Docker permission crashes
    local_temp_file = f"/tmp/{video_file_key}"
    
    try:
        # --- PHASE 1: EXTRACT FROM MINIO ---
        print(f"[{video_file_key}] Downloading payload from MinIO vault...")
        s3_client.download_file(MINIO_BUCKET, video_file_key, local_temp_file)
        self.update_state(state='PROGRESS', meta={'progress': 30})
        
        # --- PHASE 2: GOOGLE AUTHORIZATION ---
        print(f"[{video_file_key}] Forging secure Google credentials...")
        with open('client_secrets.json', 'r') as f:
            secrets = json.load(f)['web']
            
        creds = Credentials(
            token=None,
            refresh_token=user_token,
            client_id=secrets['client_id'],
            client_secret=secrets['client_secret'],
            token_uri=secrets['token_uri']
        )
        youtube = build('youtube', 'v3', credentials=creds)
        self.update_state(state='PROGRESS', meta={'progress': 50})
        
        # --- PHASE 3: TRANSMIT TO YOUTUBE ---
        print(f"[{video_file_key}] Streaming payload to YouTube servers...")
        
        request_body = {
            'snippet': {
                'title': post_title,
                'description': 'Autonomously published by DataVault Engine.',
                'categoryId': '22' 
            },
            'status': {
                'privacyStatus': 'private'
            }
        }
        
        media = MediaFileUpload(local_temp_file, chunksize=-1, resumable=True)
        
        request = youtube.videos().insert(
            part="snippet,status",
            body=request_body,
            media_body=media
        )
        
        # Execute the upload (Blocks until finished)
        response = request.execute()
        video_id = response.get('id')
        
        self.update_state(state='PROGRESS', meta={'progress': 90})
        
        print("\n" + "="*60)
        print(f"SUCCESS! Video is LIVE at: https://youtu.be/{video_id}")
        print("="*60 + "\n")
        
        self.update_state(state='SUCCESS', meta={'progress': 100})
        return f"Successfully uploaded video ID: {video_id}"
        
    except HttpError as e:
        # CRITICAL FIX 3: Catch Google API rejections (like missing YouTube channels)
        error_details = json.loads(e.content.decode('utf-8'))
        print(f"\n[GOOGLE API REJECTION]: {error_details}")
        
        # Force the bar to fail rather than retry an impossible request
        self.update_state(state='FAILURE', meta={'progress': 0})
        raise Exception(f"Google API Error: {error_details}")
        
    except Exception as e:
        retry_delay = (2 ** self.request.retries) * 10
        print(f"\n[WARNING] Pipeline Interrupted: {e}")
        print(f"[{video_file_key}] Initiating auto-recovery. Retrying in {retry_delay} seconds...")
        
        raise self.retry(exc=e, countdown=retry_delay)
        
    finally:
        # --- PHASE 4: CLEANUP ---
        if os.path.exists(local_temp_file):
            try:
                os.remove(local_temp_file)
                print(f"[{video_file_key}] Temporary workspace scrubbed.")
            except PermissionError:
                print(f"[{video_file_key}] Note: Windows locked the temp file. It will be scrubbed later.")