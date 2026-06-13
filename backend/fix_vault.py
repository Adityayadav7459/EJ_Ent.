import boto3

print("Connecting to MinIO Vault...")
# We use 'minio' to route through Docker's internal network safely
s3 = boto3.client(
    's3',
    endpoint_url="http://minio:9000", 
    aws_access_key_id="minioadmin",
    aws_secret_access_key="minioadmin",
    region_name="us-east-1"
)

bucket_name = "ej-ent-videos"

# 1. Resurrect the Bucket
try:
    s3.create_bucket(Bucket=bucket_name)
    print(f"✅ Bucket '{bucket_name}' successfully resurrected!")
except Exception as e:
    print(f"⚠️ Bucket check: {e}")

# 2. Inject the CORS Policy (This stops the ERR_CONNECTION_RESET)
cors_config = {
    'CORSRules': [
        {
            'AllowedHeaders': ['*'],
            'AllowedMethods': ['PUT', 'POST', 'GET', 'DELETE', 'HEAD'],
            'AllowedOrigins': ['*'],
            'ExposeHeaders': ['ETag']
        }
    ]
}

try:
    s3.put_bucket_cors(Bucket=bucket_name, CORSConfiguration=cors_config)
    print("✅ CORS Policy injected! React can now upload files safely.")
except Exception as e:
    print(f"❌ Failed to set CORS: {e}")