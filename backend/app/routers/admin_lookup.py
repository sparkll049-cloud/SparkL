from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.admin_auth import get_current_admin
from app.supabase_client import supabase

router = APIRouter(prefix="/api/admin/lookup", tags=["admin-lookup"])

# Whitelist of tables this generic CRUD is allowed to touch
ALLOWED_TABLES = {
    "institutions",
    "departments",
    "courses",
    "levels",
    "study_modes",
    "semesters",
}


class LookupItem(BaseModel):
    name: str
    institution_id: Optional[str] = None
    department_id: Optional[str] = None
    sort_order: Optional[int] = None


def validate_table(table: str):
    if table not in ALLOWED_TABLES:
        raise HTTPException(status_code=404, detail="Unknown table")


@router.get("/{table}")
async def list_items(table: str, admin_id: str = Depends(get_current_admin)):
    validate_table(table)
    res = supabase.table(table).select("*").order("name").execute()
    return res.data


@router.post("/{table}")
async def create_item(
    table: str,
    item: LookupItem,
    admin_id: str = Depends(get_current_admin),
):
    validate_table(table)

    payload = {"name": item.name}
    if item.institution_id:
        payload["institution_id"] = item.institution_id
    if item.department_id:
        payload["department_id"] = item.department_id
    if item.sort_order is not None:
        payload["sort_order"] = item.sort_order

    res = supabase.table(table).insert(payload).execute()

    if not res.data:
        raise HTTPException(status_code=400, detail="Failed to create item")

    return res.data[0]


@router.patch("/{table}/{item_id}")
async def update_item(
    table: str,
    item_id: str,
    item: LookupItem,
    admin_id: str = Depends(get_current_admin),
):
    validate_table(table)

    payload = {"name": item.name}
    if item.institution_id:
        payload["institution_id"] = item.institution_id
    if item.department_id:
        payload["department_id"] = item.department_id
    if item.sort_order is not None:
        payload["sort_order"] = item.sort_order

    res = supabase.table(table).update(payload).eq("id", item_id).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Item not found")

    return res.data[0]


@router.delete("/{table}/{item_id}")
async def delete_item(
    table: str,
    item_id: str,
    admin_id: str = Depends(get_current_admin),
):
    validate_table(table)

    # Check the row exists first, so a delete on a missing/already-deleted
    # id reports 404 instead of a false "deleted": True.
    existing = supabase.table(table).select("id").eq("id", item_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Item not found")

    res = supabase.table(table).delete().eq("id", item_id).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Item not found")

    return {"deleted": True}
