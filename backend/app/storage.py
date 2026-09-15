import boto3
import uuid
import os
from botocore.client import Config
from fastapi import UploadFile, HTTPException

B2_ENDPOINT = os.getenv("B2_ENDPOINT", "")
B2_KEY_ID   = os.getenv("B2_KEY_ID", "")
B2_APP_KEY  = os.getenv("B2_APP_KEY", "")
B2_BUCKET   = os.getenv("B2_BUCKET_NAME", "sparkl-questions")

ALLOWED_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB


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


async def upload_past_question(
    file: UploadFile,
    institution_id: str,
    department_id: str,
    course_id: str,
    year: int,
) -> dict:
    # Validate type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: PDF, DOC, DOCX, JPG, PNG"
        )

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File too large. Max size is 20MB."
        )

    # Build organized path
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "pdf"
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    key = f"past-questions/{institution_id}/{department_id}/{course_id}/{year}/{unique_name}"

    # Upload to B2
    try:
        _client().put_object(
            Bucket=B2_BUCKET,
            Key=key,
            Body=contents,
            ContentType=file.content_type,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    # Return the key and a signed URL valid for 1 hour
    url = _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": B2_BUCKET, "Key": key},
        ExpiresIn=3600,
    )

    return {
        "key": key,
        "url": url,
        "filename": file.filename,
        "content_type": file.content_type,
        "size_bytes": len(contents),
    }


def get_signed_url(key: str, expires_in: int = 3600) -> str:
    """Generate a fresh signed URL for an existing file."""
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": B2_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )


def delete_file(key: str) -> None:
    """Delete a file from B2."""
    try:
        _client().delete_object(Bucket=B2_BUCKET, Key=key)
    except Exception:
        pass