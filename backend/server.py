from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Request, status
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field


# ────────────────────────────────────────────────────────────
# App & DB
# ────────────────────────────────────────────────────────────
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="School Management API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 12  # 12h for ERP convenience

ROLES = ["admin", "principal", "staff"]
RESOURCES = ["students", "classes", "fee_components", "discounts", "invoices", "payments", "users", "settings"]
ACTIONS = ["view", "edit", "delete"]

# Default permissions
DEFAULT_PERMISSIONS = {
    "admin": {r: {"view": True, "edit": True, "delete": True} for r in RESOURCES},
    "principal": {
        "students": {"view": True, "edit": True, "delete": True},
        "classes": {"view": True, "edit": True, "delete": True},
        "fee_components": {"view": True, "edit": True, "delete": True},
        "discounts": {"view": True, "edit": True, "delete": False},
        "invoices": {"view": True, "edit": True, "delete": False},
        "payments": {"view": True, "edit": True, "delete": False},
        "users": {"view": True, "edit": False, "delete": False},
        "settings": {"view": True, "edit": True, "delete": False},
    },
    "staff": {
        "students": {"view": True, "edit": True, "delete": False},
        "classes": {"view": True, "edit": False, "delete": False},
        "fee_components": {"view": True, "edit": False, "delete": False},
        "discounts": {"view": True, "edit": False, "delete": False},
        "invoices": {"view": True, "edit": True, "delete": False},
        "payments": {"view": True, "edit": True, "delete": False},
        "users": {"view": False, "edit": False, "delete": False},
        "settings": {"view": True, "edit": False, "delete": False},
    },
}


# ────────────────────────────────────────────────────────────
# Utils
# ────────────────────────────────────────────────────────────
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, username: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def strip_mongo(doc: dict) -> dict:
    if doc is None:
        return doc
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


# ────────────────────────────────────────────────────────────
# Auth dependency
# ────────────────────────────────────────────────────────────
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return strip_mongo(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_permissions_map() -> Dict[str, Any]:
    doc = await db.role_permissions.find_one({"id": "role_permissions"})
    if not doc:
        return DEFAULT_PERMISSIONS
    return doc.get("permissions", DEFAULT_PERMISSIONS)


def require_permission(resource: str, action: str):
    async def dep(user: dict = Depends(get_current_user)):
        role = user.get("role", "staff")
        if role == "admin":
            return user
        perms = await get_permissions_map()
        role_perm = perms.get(role, {}).get(resource, {})
        if not role_perm.get(action, False):
            raise HTTPException(status_code=403, detail=f"Missing permission: {resource}.{action}")
        return user
    return dep


def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# ────────────────────────────────────────────────────────────
# Models
# ────────────────────────────────────────────────────────────
class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    name: str
    role: str
    created_at: str


class UserCreate(BaseModel):
    username: str
    password: str
    name: str
    role: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None


class ClassIn(BaseModel):
    name: str
    section: Optional[str] = ""
    academic_year: Optional[str] = ""


class StudentIn(BaseModel):
    name: str
    class_id: str
    roll_no: Optional[str] = ""
    guardian_name: Optional[str] = ""
    guardian_phone: Optional[str] = ""
    admission_no: Optional[str] = ""
    dob: Optional[str] = ""
    address: Optional[str] = ""
    gender: Optional[str] = ""


class FeeComponentIn(BaseModel):
    name: str  # e.g. Tuition, Transport
    frequency: str  # monthly | quarterly | yearly | one_time
    default_amount: float = 0.0
    description: Optional[str] = ""


class FeeOverrideIn(BaseModel):
    fee_component_id: str
    scope: str  # class | student
    scope_id: str  # class_id or student_id
    amount: float


class DiscountIn(BaseModel):
    student_id: str
    fee_component_id: Optional[str] = None  # None = applies to all
    amount: float  # fixed
    reason: Optional[str] = ""


class InvoiceIn(BaseModel):
    student_id: str
    period_label: str  # e.g. "Jan 2026", "Q1 2026", "AY 2025-26", "One-time"
    frequency: str  # monthly | quarterly | yearly | one_time
    component_ids: Optional[List[str]] = None  # if None, all components matching frequency
    due_date: Optional[str] = ""
    notes: Optional[str] = ""


class PaymentIn(BaseModel):
    invoice_id: str
    amount: float
    method: str = "cash"  # cash | upi | card | bank
    reference: Optional[str] = ""
    notes: Optional[str] = ""


class SettingsIn(BaseModel):
    school_name: str = "My School"
    address: str = ""
    phone: str = ""
    email: str = ""
    logo_url: str = ""
    receipt_header: str = "Fee Receipt"
    receipt_footer: str = "This is a computer generated receipt."
    show_logo: bool = True
    show_signature_line: bool = True
    receipt_prefix: str = "RCPT"
    currency_symbol: str = "₹"


class PermissionsIn(BaseModel):
    permissions: Dict[str, Dict[str, Dict[str, bool]]]


# ────────────────────────────────────────────────────────────
# Auth endpoints
# ────────────────────────────────────────────────────────────
@api_router.post("/auth/login")
async def login(body: LoginIn):
    username = body.username.strip().lower()
    user = await db.users.find_one({"username": username})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token(user["id"], user["username"], user["role"])
    return {"token": token, "user": strip_mongo(user)}


@api_router.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ────────────────────────────────────────────────────────────
# Users
# ────────────────────────────────────────────────────────────
@api_router.get("/users")
async def list_users(user: dict = Depends(require_permission("users", "view"))):
    users = await db.users.find({}).to_list(1000)
    return [strip_mongo(u) for u in users]


@api_router.post("/users")
async def create_user(body: UserCreate, user: dict = Depends(require_admin)):
    if body.role not in ROLES:
        raise HTTPException(400, "Invalid role")
    username = body.username.strip().lower()
    exists = await db.users.find_one({"username": username})
    if exists:
        raise HTTPException(400, "Username already exists")
    doc = {
        "id": new_id(),
        "username": username,
        "name": body.name,
        "role": body.role,
        "password_hash": hash_password(body.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    return strip_mongo(doc)


@api_router.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdate, user: dict = Depends(require_admin)):
    update = {}
    if body.name is not None:
        update["name"] = body.name
    if body.role is not None:
        if body.role not in ROLES:
            raise HTTPException(400, "Invalid role")
        update["role"] = body.role
    if body.password:
        update["password_hash"] = hash_password(body.password)
    if not update:
        raise HTTPException(400, "Nothing to update")
    res = await db.users.update_one({"id": user_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "User not found")
    doc = await db.users.find_one({"id": user_id})
    return strip_mongo(doc)


@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, user: dict = Depends(require_admin)):
    if user_id == user["id"]:
        raise HTTPException(400, "Cannot delete yourself")
    res = await db.users.delete_one({"id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}


# ────────────────────────────────────────────────────────────
# Permissions
# ────────────────────────────────────────────────────────────
@api_router.get("/permissions")
async def get_permissions(user: dict = Depends(get_current_user)):
    perms = await get_permissions_map()
    return {"permissions": perms, "resources": RESOURCES, "actions": ACTIONS, "roles": ROLES}


@api_router.put("/permissions")
async def update_permissions(body: PermissionsIn, user: dict = Depends(require_admin)):
    await db.role_permissions.update_one(
        {"id": "role_permissions"},
        {"$set": {"id": "role_permissions", "permissions": body.permissions, "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True, "permissions": body.permissions}


# ────────────────────────────────────────────────────────────
# Classes
# ────────────────────────────────────────────────────────────
@api_router.get("/classes")
async def list_classes(user: dict = Depends(require_permission("classes", "view"))):
    rows = await db.classes.find({}).sort("name", 1).to_list(1000)
    return [strip_mongo(r) for r in rows]


@api_router.post("/classes")
async def create_class(body: ClassIn, user: dict = Depends(require_permission("classes", "edit"))):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.classes.insert_one(doc)
    return strip_mongo(doc)


@api_router.put("/classes/{class_id}")
async def update_class(class_id: str, body: ClassIn, user: dict = Depends(require_permission("classes", "edit"))):
    res = await db.classes.update_one({"id": class_id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Class not found")
    doc = await db.classes.find_one({"id": class_id})
    return strip_mongo(doc)


@api_router.delete("/classes/{class_id}")
async def delete_class(class_id: str, user: dict = Depends(require_permission("classes", "delete"))):
    student_count = await db.students.count_documents({"class_id": class_id})
    if student_count > 0:
        raise HTTPException(400, f"Cannot delete class with {student_count} student(s)")
    res = await db.classes.delete_one({"id": class_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Class not found")
    # cleanup class-level overrides
    await db.fee_overrides.delete_many({"scope": "class", "scope_id": class_id})
    return {"ok": True}


# ────────────────────────────────────────────────────────────
# Students
# ────────────────────────────────────────────────────────────
@api_router.get("/students")
async def list_students(class_id: Optional[str] = None, user: dict = Depends(require_permission("students", "view"))):
    q = {}
    if class_id:
        q["class_id"] = class_id
    rows = await db.students.find(q).sort("name", 1).to_list(2000)
    return [strip_mongo(r) for r in rows]


@api_router.get("/students/{student_id}")
async def get_student(student_id: str, user: dict = Depends(require_permission("students", "view"))):
    s = await db.students.find_one({"id": student_id})
    if not s:
        raise HTTPException(404, "Student not found")
    return strip_mongo(s)


@api_router.post("/students")
async def create_student(body: StudentIn, user: dict = Depends(require_permission("students", "edit"))):
    cls = await db.classes.find_one({"id": body.class_id})
    if not cls:
        raise HTTPException(400, "Invalid class_id")
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.students.insert_one(doc)
    return strip_mongo(doc)


@api_router.put("/students/{student_id}")
async def update_student(student_id: str, body: StudentIn, user: dict = Depends(require_permission("students", "edit"))):
    res = await db.students.update_one({"id": student_id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Student not found")
    doc = await db.students.find_one({"id": student_id})
    return strip_mongo(doc)


@api_router.delete("/students/{student_id}")
async def delete_student(student_id: str, user: dict = Depends(require_permission("students", "delete"))):
    res = await db.students.delete_one({"id": student_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Student not found")
    await db.fee_overrides.delete_many({"scope": "student", "scope_id": student_id})
    await db.discounts.delete_many({"student_id": student_id})
    return {"ok": True}


# ────────────────────────────────────────────────────────────
# Fee components
# ────────────────────────────────────────────────────────────
FREQUENCIES = {"monthly", "quarterly", "yearly", "one_time"}


@api_router.get("/fee-components")
async def list_fee_components(user: dict = Depends(require_permission("fee_components", "view"))):
    rows = await db.fee_components.find({}).sort("name", 1).to_list(1000)
    return [strip_mongo(r) for r in rows]


@api_router.post("/fee-components")
async def create_fee_component(body: FeeComponentIn, user: dict = Depends(require_permission("fee_components", "edit"))):
    if body.frequency not in FREQUENCIES:
        raise HTTPException(400, "Invalid frequency")
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.fee_components.insert_one(doc)
    return strip_mongo(doc)


@api_router.put("/fee-components/{fc_id}")
async def update_fee_component(fc_id: str, body: FeeComponentIn, user: dict = Depends(require_permission("fee_components", "edit"))):
    if body.frequency not in FREQUENCIES:
        raise HTTPException(400, "Invalid frequency")
    res = await db.fee_components.update_one({"id": fc_id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Fee component not found")
    doc = await db.fee_components.find_one({"id": fc_id})
    return strip_mongo(doc)


@api_router.delete("/fee-components/{fc_id}")
async def delete_fee_component(fc_id: str, user: dict = Depends(require_permission("fee_components", "delete"))):
    res = await db.fee_components.delete_one({"id": fc_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Fee component not found")
    await db.fee_overrides.delete_many({"fee_component_id": fc_id})
    await db.discounts.delete_many({"fee_component_id": fc_id})
    return {"ok": True}


# ────────────────────────────────────────────────────────────
# Fee overrides
# ────────────────────────────────────────────────────────────
@api_router.get("/fee-overrides")
async def list_fee_overrides(
    scope: Optional[str] = None,
    scope_id: Optional[str] = None,
    fee_component_id: Optional[str] = None,
    user: dict = Depends(require_permission("fee_components", "view")),
):
    q = {}
    if scope:
        q["scope"] = scope
    if scope_id:
        q["scope_id"] = scope_id
    if fee_component_id:
        q["fee_component_id"] = fee_component_id
    rows = await db.fee_overrides.find(q).to_list(2000)
    return [strip_mongo(r) for r in rows]


@api_router.post("/fee-overrides")
async def upsert_fee_override(body: FeeOverrideIn, user: dict = Depends(require_permission("fee_components", "edit"))):
    if body.scope not in {"class", "student"}:
        raise HTTPException(400, "Invalid scope")
    existing = await db.fee_overrides.find_one(
        {"fee_component_id": body.fee_component_id, "scope": body.scope, "scope_id": body.scope_id}
    )
    if existing:
        await db.fee_overrides.update_one(
            {"id": existing["id"]}, {"$set": {"amount": body.amount, "updated_at": now_iso()}}
        )
        doc = await db.fee_overrides.find_one({"id": existing["id"]})
        return strip_mongo(doc)
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.fee_overrides.insert_one(doc)
    return strip_mongo(doc)


@api_router.delete("/fee-overrides/{override_id}")
async def delete_fee_override(override_id: str, user: dict = Depends(require_permission("fee_components", "delete"))):
    res = await db.fee_overrides.delete_one({"id": override_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Override not found")
    return {"ok": True}


# ────────────────────────────────────────────────────────────
# Discounts
# ────────────────────────────────────────────────────────────
@api_router.get("/discounts")
async def list_discounts(
    student_id: Optional[str] = None,
    user: dict = Depends(require_permission("discounts", "view")),
):
    q = {}
    if student_id:
        q["student_id"] = student_id
    rows = await db.discounts.find(q).to_list(2000)
    return [strip_mongo(r) for r in rows]


@api_router.post("/discounts")
async def create_discount(body: DiscountIn, user: dict = Depends(require_permission("discounts", "edit"))):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.discounts.insert_one(doc)
    return strip_mongo(doc)


@api_router.put("/discounts/{did}")
async def update_discount(did: str, body: DiscountIn, user: dict = Depends(require_permission("discounts", "edit"))):
    res = await db.discounts.update_one({"id": did}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(404, "Discount not found")
    doc = await db.discounts.find_one({"id": did})
    return strip_mongo(doc)


@api_router.delete("/discounts/{did}")
async def delete_discount(did: str, user: dict = Depends(require_permission("discounts", "delete"))):
    res = await db.discounts.delete_one({"id": did})
    if res.deleted_count == 0:
        raise HTTPException(404, "Discount not found")
    return {"ok": True}


# ────────────────────────────────────────────────────────────
# Fee calculation for a student
# ────────────────────────────────────────────────────────────
async def resolve_amount_for_student(fc: dict, student: dict) -> float:
    # student override wins
    s_override = await db.fee_overrides.find_one(
        {"fee_component_id": fc["id"], "scope": "student", "scope_id": student["id"]}
    )
    if s_override:
        return float(s_override["amount"])
    c_override = await db.fee_overrides.find_one(
        {"fee_component_id": fc["id"], "scope": "class", "scope_id": student["class_id"]}
    )
    if c_override:
        return float(c_override["amount"])
    return float(fc.get("default_amount", 0.0))


@api_router.get("/students/{student_id}/fee-structure")
async def student_fee_structure(student_id: str, user: dict = Depends(require_permission("students", "view"))):
    s = await db.students.find_one({"id": student_id})
    if not s:
        raise HTTPException(404, "Student not found")
    fcs = await db.fee_components.find({}).to_list(1000)
    discounts = await db.discounts.find({"student_id": student_id}).to_list(500)
    all_disc = sum(float(d["amount"]) for d in discounts if not d.get("fee_component_id"))
    per_comp_disc: Dict[str, float] = {}
    for d in discounts:
        if d.get("fee_component_id"):
            per_comp_disc[d["fee_component_id"]] = per_comp_disc.get(d["fee_component_id"], 0.0) + float(d["amount"])
    items = []
    for fc in fcs:
        amt = await resolve_amount_for_student(fc, s)
        items.append(
            {
                "fee_component_id": fc["id"],
                "name": fc["name"],
                "frequency": fc["frequency"],
                "amount": amt,
                "discount": per_comp_disc.get(fc["id"], 0.0),
            }
        )
    return {"items": items, "general_discount": all_disc, "discounts": [strip_mongo(d) for d in discounts]}


# ────────────────────────────────────────────────────────────
# Invoices
# ────────────────────────────────────────────────────────────
@api_router.get("/invoices")
async def list_invoices(
    student_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    user: dict = Depends(require_permission("invoices", "view")),
):
    q = {}
    if student_id:
        q["student_id"] = student_id
    if status_filter:
        q["status"] = status_filter
    rows = await db.invoices.find(q).sort("created_at", -1).to_list(2000)
    return [strip_mongo(r) for r in rows]


@api_router.get("/invoices/{inv_id}")
async def get_invoice(inv_id: str, user: dict = Depends(require_permission("invoices", "view"))):
    inv = await db.invoices.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    return strip_mongo(inv)


@api_router.post("/invoices")
async def create_invoice(body: InvoiceIn, user: dict = Depends(require_permission("invoices", "edit"))):
    student = await db.students.find_one({"id": body.student_id})
    if not student:
        raise HTTPException(400, "Invalid student_id")
    if body.frequency not in FREQUENCIES:
        raise HTTPException(400, "Invalid frequency")
    fcs_query = {"frequency": body.frequency}
    if body.component_ids:
        fcs_query["id"] = {"$in": body.component_ids}
    fcs = await db.fee_components.find(fcs_query).to_list(500)
    if not fcs:
        raise HTTPException(400, "No matching fee components")
    discounts = await db.discounts.find({"student_id": body.student_id}).to_list(500)
    per_comp_disc: Dict[str, float] = {}
    all_disc = 0.0
    for d in discounts:
        if d.get("fee_component_id"):
            per_comp_disc[d["fee_component_id"]] = per_comp_disc.get(d["fee_component_id"], 0.0) + float(d["amount"])
        else:
            all_disc += float(d["amount"])
    items = []
    subtotal = 0.0
    total_disc = 0.0
    for fc in fcs:
        amt = await resolve_amount_for_student(fc, student)
        disc = per_comp_disc.get(fc["id"], 0.0)
        line_total = max(0.0, amt - disc)
        items.append(
            {
                "fee_component_id": fc["id"],
                "name": fc["name"],
                "amount": amt,
                "discount": disc,
                "total": line_total,
            }
        )
        subtotal += amt
        total_disc += disc
    total_disc += all_disc
    total = max(0.0, subtotal - total_disc)
    inv_number = f"INV-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    doc = {
        "id": new_id(),
        "invoice_number": inv_number,
        "student_id": body.student_id,
        "student_name": student["name"],
        "class_id": student["class_id"],
        "period_label": body.period_label,
        "frequency": body.frequency,
        "items": items,
        "subtotal": subtotal,
        "general_discount": all_disc,
        "total_discount": total_disc,
        "total": total,
        "paid_amount": 0.0,
        "status": "pending",  # pending | partial | paid
        "due_date": body.due_date,
        "notes": body.notes,
        "created_at": now_iso(),
        "created_by": user["username"],
    }
    await db.invoices.insert_one(doc)
    return strip_mongo(doc)


@api_router.delete("/invoices/{inv_id}")
async def delete_invoice(inv_id: str, user: dict = Depends(require_permission("invoices", "delete"))):
    inv = await db.invoices.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(404, "Invoice not found")
    if inv.get("paid_amount", 0) > 0:
        raise HTTPException(400, "Cannot delete invoice with payments recorded")
    await db.invoices.delete_one({"id": inv_id})
    return {"ok": True}


# ────────────────────────────────────────────────────────────
# Payments (receipts)
# ────────────────────────────────────────────────────────────
async def _next_receipt_number() -> str:
    settings = await db.settings.find_one({"id": "settings"}) or {}
    prefix = settings.get("receipt_prefix", "RCPT")
    count = await db.payments.count_documents({})
    return f"{prefix}-{datetime.now(timezone.utc).strftime('%Y%m')}-{count + 1:05d}"


@api_router.get("/payments")
async def list_payments(
    student_id: Optional[str] = None,
    invoice_id: Optional[str] = None,
    user: dict = Depends(require_permission("payments", "view")),
):
    q = {}
    if student_id:
        q["student_id"] = student_id
    if invoice_id:
        q["invoice_id"] = invoice_id
    rows = await db.payments.find(q).sort("created_at", -1).to_list(2000)
    return [strip_mongo(r) for r in rows]


@api_router.get("/payments/{pid}")
async def get_payment(pid: str, user: dict = Depends(require_permission("payments", "view"))):
    p = await db.payments.find_one({"id": pid})
    if not p:
        raise HTTPException(404, "Payment not found")
    return strip_mongo(p)


@api_router.post("/payments")
async def create_payment(body: PaymentIn, user: dict = Depends(require_permission("payments", "edit"))):
    inv = await db.invoices.find_one({"id": body.invoice_id})
    if not inv:
        raise HTTPException(400, "Invalid invoice_id")
    if body.amount <= 0:
        raise HTTPException(400, "Amount must be positive")
    remaining = float(inv["total"]) - float(inv.get("paid_amount", 0))
    if body.amount > remaining + 0.001:
        raise HTTPException(400, f"Amount exceeds remaining {remaining}")
    receipt_number = await _next_receipt_number()
    doc = {
        "id": new_id(),
        "receipt_number": receipt_number,
        "invoice_id": inv["id"],
        "invoice_number": inv["invoice_number"],
        "student_id": inv["student_id"],
        "student_name": inv["student_name"],
        "class_id": inv["class_id"],
        "period_label": inv["period_label"],
        "amount": body.amount,
        "method": body.method,
        "reference": body.reference,
        "notes": body.notes,
        "items_snapshot": inv["items"],
        "invoice_total": inv["total"],
        "created_at": now_iso(),
        "collected_by": user["username"],
    }
    await db.payments.insert_one(doc)
    new_paid = float(inv.get("paid_amount", 0)) + float(body.amount)
    new_status = "paid" if new_paid >= float(inv["total"]) - 0.001 else "partial"
    await db.invoices.update_one(
        {"id": inv["id"]}, {"$set": {"paid_amount": new_paid, "status": new_status}}
    )
    return strip_mongo(doc)


@api_router.delete("/payments/{pid}")
async def delete_payment(pid: str, user: dict = Depends(require_permission("payments", "delete"))):
    p = await db.payments.find_one({"id": pid})
    if not p:
        raise HTTPException(404, "Payment not found")
    await db.payments.delete_one({"id": pid})
    inv = await db.invoices.find_one({"id": p["invoice_id"]})
    if inv:
        new_paid = max(0.0, float(inv.get("paid_amount", 0)) - float(p["amount"]))
        new_status = "paid" if new_paid >= float(inv["total"]) - 0.001 else ("partial" if new_paid > 0 else "pending")
        await db.invoices.update_one(
            {"id": inv["id"]}, {"$set": {"paid_amount": new_paid, "status": new_status}}
        )
    return {"ok": True}


# ────────────────────────────────────────────────────────────
# Settings
# ────────────────────────────────────────────────────────────
@api_router.get("/settings")
async def get_settings(user: dict = Depends(require_permission("settings", "view"))):
    doc = await db.settings.find_one({"id": "settings"})
    if not doc:
        return SettingsIn().model_dump()
    return strip_mongo(doc)


@api_router.put("/settings")
async def update_settings(body: SettingsIn, user: dict = Depends(require_permission("settings", "edit"))):
    payload = {"id": "settings", **body.model_dump(), "updated_at": now_iso()}
    await db.settings.update_one({"id": "settings"}, {"$set": payload}, upsert=True)
    return {k: v for k, v in payload.items() if k != "_id"}


# ────────────────────────────────────────────────────────────
# Dashboard stats
# ────────────────────────────────────────────────────────────
@api_router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    total_students = await db.students.count_documents({})
    total_classes = await db.classes.count_documents({})
    total_invoices = await db.invoices.count_documents({})
    total_pending = await db.invoices.count_documents({"status": {"$in": ["pending", "partial"]}})
    # Total collected this month
    payments = await db.payments.find({}).to_list(5000)
    now = datetime.now(timezone.utc)
    month_prefix = now.strftime("%Y-%m")
    collected_month = sum(float(p["amount"]) for p in payments if str(p.get("created_at", "")).startswith(month_prefix))
    collected_total = sum(float(p["amount"]) for p in payments)
    invoices = await db.invoices.find({}).to_list(5000)
    outstanding = sum(max(0.0, float(i["total"]) - float(i.get("paid_amount", 0))) for i in invoices)
    return {
        "total_students": total_students,
        "total_classes": total_classes,
        "total_invoices": total_invoices,
        "total_pending_invoices": total_pending,
        "collected_this_month": collected_month,
        "collected_total": collected_total,
        "outstanding": outstanding,
    }


# ────────────────────────────────────────────────────────────
# Router mount & CORS
# ────────────────────────────────────────────────────────────
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ────────────────────────────────────────────────────────────
# Startup: seed admin & indexes
# ────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("username", unique=True)
        await db.students.create_index("class_id")
        await db.invoices.create_index("student_id")
        await db.payments.create_index("student_id")
    except Exception as e:
        logger.warning(f"index creation warn: {e}")

    admin_username = os.environ.get("ADMIN_USERNAME", "admin").strip().lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"username": admin_username})
    if existing is None:
        await db.users.insert_one(
            {
                "id": new_id(),
                "username": admin_username,
                "name": "Administrator",
                "role": "admin",
                "password_hash": hash_password(admin_password),
                "created_at": now_iso(),
            }
        )
        logger.info(f"Seeded admin user: {admin_username}")
    else:
        if not verify_password(admin_password, existing.get("password_hash", "")):
            await db.users.update_one(
                {"username": admin_username},
                {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}},
            )
            logger.info("Updated admin password to match .env")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
