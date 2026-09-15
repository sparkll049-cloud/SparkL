import boto3
import uuid
import os
from botocore.client import Config
from fastapi import HTTPException

B2_ENDPOINT = os.getenv("B2_ENDPOINT", "")
B2_KEY_ID   = os.getenv("B2_KEY_ID", "")
B2_APP_KEY  = os.getenv("B2_APP_KEY", "")
B2_BUCKET   = os.getenv("B2_BUCKET_NAME", "sparkl-questions")


def _client():
    endpoint = B2_ENDPOINT
    if not endpoint.startswith("http"):
        endpoint = f"https://{endpoint}"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=B2_KEY_ID,
        aws_secret_access_key=B2_APP_KEY,
        config=Config(signature_version="s3v4"),
    )


def upload_file(
    file_bytes: bytes,
    user_id: str,
    mime_type: str,
    ext: str,
) -> str:
    """Upload bytes to B2 and return the storage key."""
    key = f"past-questions/{user_id}/{uuid.uuid4()}.{ext}"
    try:
        _client().put_object(
            Bucket=B2_BUCKET,
            Key=key,
            Body=file_bytes,
            ContentType=mime_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {str(e)}")
    return key


def get_signed_url(key: str, expires_in: int = 3600) -> str:
    """Generate a signed URL valid for expires_in seconds."""
    try:
        return _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": B2_BUCKET, "Key": key},
            ExpiresIn=expires_in,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not generate URL: {str(e)}")


def delete_file(key: str) -> None:
    """Delete a file from B2 — best effort."""
    try:
        _client().delete_object(Bucket=B2_BUCKET, Key=key)
    except Exception:
        pass