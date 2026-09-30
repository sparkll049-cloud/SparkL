# storage.py
"""Private Backblaze B2 storage helpers for SparkL."""
from __future__ import annotations

import os
import uuid

import boto3
from botocore.client import Config
from fastapi import HTTPException

B2_ENDPOINT = os.getenv("B2_ENDPOINT", "")
B2_KEY_ID = os.getenv("B2_KEY_ID", "")
B2_APP_KEY = os.getenv("B2_APP_KEY", "")
B2_BUCKET = os.getenv("B2_BUCKET_NAME", "sparkl-questions")


def _client():
    if not B2_ENDPOINT or not B2_KEY_ID or not B2_APP_KEY:
        raise HTTPException(status_code=500, detail="B2 storage is not configured.")
    endpoint = B2_ENDPOINT if B2_ENDPOINT.startswith("http") else f"https://{B2_ENDPOINT}"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=B2_KEY_ID,
        aws_secret_access_key=B2_APP_KEY,
        config=Config(signature_version="s3v4"),
    )


def upload_file(file_bytes: bytes, user_id: str, mime_type: str, ext: str) -> str:
    key = f"past-questions/{user_id}/{uuid.uuid4()}.{ext}"
    return upload_bytes(file_bytes, key, mime_type)


def upload_bytes(file_bytes: bytes, key: str, mime_type: str) -> str:
    try:
        _client().put_object(
            Bucket=B2_BUCKET,
            Key=key,
            Body=file_bytes,
            ContentType=mime_type,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Storage upload failed.") from exc
    return key


def download_bytes(key: str) -> bytes:
    try:
        response = _client().get_object(Bucket=B2_BUCKET, Key=key)
        return response["Body"].read()
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Stored file not found.") from exc


def get_signed_url(key: str, expires_in: int = 300) -> str:
    expires_in = max(1, min(int(expires_in), 600))
    try:
        return _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": B2_BUCKET, "Key": key},
            ExpiresIn=expires_in,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Could not generate preview URL.") from exc


def delete_file(key: str) -> None:
    if not key:
        return
    try:
        _client().delete_object(Bucket=B2_BUCKET, Key=key)
    except Exception:
        pass


def list_keys_with_prefix(prefix: str) -> list[str]:
    """List all B2 keys under a given prefix."""
    try:
        paginator = _client().get_paginator("list_objects_v2")
        keys = []
        for page in paginator.paginate(Bucket=B2_BUCKET, Prefix=prefix):
            for obj in page.get("Contents", []):
                keys.append(obj["Key"])
        return keys
    except Exception:
        return []