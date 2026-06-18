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

    db = SessionLocal()
    account = db.query(models.ConnectedAccount).filter(
        models.ConnectedAccount.user_id == uuid.UUID(user_id),
        models.ConnectedAccount.platform == "youtube"
    ).first()
    
    user_token = account.refresh_token if account else None
    db.close()
    
    # GUARD 1: Fail instantly if the user has no token (Prevents 0% Hang)
    if not user_token:
        print(f"[{video_file_key}] ERROR: No connected YouTube account found in DB.")
        raise ValueError("User has not connected their YouTube account.")
        
    # GUARD 2: Secure Docker file path
    local_temp_file = f"/tmp/{video_file_key}"
    
    try:
        print(f"[{video_file_key}] Downloading payload from MinIO vault...")
        s3_client.download_file(MINIO_BUCKET, video_file_key, local_temp_file)
        self.update_state(state='PROGRESS', meta={'progress': 30})
        
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
        request = youtube.videos().insert(part="snippet,status", body=request_body, media_body=media)
        
        response = request.execute()
        video_id = response.get('id')
        
        self.update_state(state='PROGRESS', meta={'progress': 90})
        print(f"\nSUCCESS! Video is LIVE at: https://youtu.be/{video_id}\n")
        self.update_state(state='SUCCESS', meta={'progress': 100})
        return f"Successfully uploaded video ID: {video_id}"
        
    except HttpError as e:
        # GUARD 3: Catch Google Rejections (e.g., No YouTube Channel exists for this email)
        error_details = json.loads(e.content.decode('utf-8'))
        print(f"\n[GOOGLE API REJECTION]: {error_details}")
        raise ValueError(f"Google API Error: {error_details}")
        
    except Exception as e:
        retry_delay = (2 ** self.request.retries) * 10
        print(f"\n[WARNING] Pipeline Interrupted: {e}")
        print(f"[{video_file_key}] Retrying in {retry_delay} seconds...")
        raise self.retry(exc=e, countdown=retry_delay)
        
    finally:
        if os.path.exists(local_temp_file):
            try:
                os.remove(local_temp_file)
            except PermissionError:
                pass