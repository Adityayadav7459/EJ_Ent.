import os
import ssl
import json
import boto3
import uuid
from celery import Celery
from dotenv import load_dotenv
from database import SessionLocal
import models

#GOOGLE API ENGINES ---
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

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
    endpoint_url="http://minio:9000",  # <--- THE MAGIC BRIDGE
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
    
    # 2. THE FIX: Cast the string user_id to a native UUID object
    account = db.query(models.ConnectedAccount).filter(
        models.ConnectedAccount.user_id == uuid.UUID(user_id), # <-- Cast applied here!
        models.ConnectedAccount.platform == "youtube"
    ).first()
    
    # 3. Extract THEIR specific token
    user_token = account.refresh_token if account else None
    db.close()
        
    # 4. We inject the dynamic token into the Google Credentials!
    # (In your upcoming Google API logic, you will use `user_token` instead of the .env variable)
    
    local_temp_file = f"temp_{video_file_key}"
    
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
        
        # uploaded as PRIVATE so it don't accidentally spam a public channel while testing.
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
        
        # Execute the upload (This may take several seconds depending on file size)
        response = request.execute()
        video_id = response.get('id')
        
        self.update_state(state='PROGRESS', meta={'progress': 90})
        
        print("\n" + "="*60)
        print(f"SUCCESS! Video is LIVE at: https://youtu.be/{video_id}")
        print("="*60 + "\n")
        
    except Exception as e:
        # 1. Calculate the exponential delay (2^retries * 10 seconds)
        # Attempt 0 -> 10s | Attempt 1 -> 20s | Attempt 2 -> 40s
        retry_delay = (2 ** self.request.retries) * 10
        
        print(f"\n[WARNING] Pipeline Interrupted: {e}")
        print(f"[{video_file_key}] Initiating auto-recovery. Retrying in {retry_delay} seconds (Attempt {self.request.retries + 1}/3)...")
        
        # 2. Tell Celery to pause and re-queue the exact same job
        # This will securely raise the exception ONLY if we hit our max_retries limit
        raise self.retry(exc=e, countdown=retry_delay)
        
    finally:
        # --- PHASE 4: CLEANUP ---
        # Always scrub the temporary file so we don't blow up our hard drive.
        if os.path.exists(local_temp_file):
            try:
                os.remove(local_temp_file)
                print(f"[{video_file_key}] Temporary workspace scrubbed.")
            except PermissionError:
                # If Windows locks the file during a crash, ignore the error gracefully
                print(f"[{video_file_key}] Note: Windows locked the temp file. It will be scrubbed on next system reboot.")

    self.update_state(state='SUCCESS', meta={'progress': 100})
    return f"Successfully uploaded video ID: {video_id}"