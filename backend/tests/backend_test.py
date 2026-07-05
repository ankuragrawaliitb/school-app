"""
End-to-end backend tests for the School Management App.
Covers: auth, users, permissions, classes, students, fee_components,
fee_overrides (priority resolution), discounts, invoices, payments, settings, stats.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fee-receipt-pro-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "admin123"


# ────────────────────────────────────────────
# Fixtures
# ────────────────────────────────────────────
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    assert data["user"]["username"] == ADMIN_USER
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def seed(admin_headers):
    """Create a class, a fee component and a student. Cleanup at end."""
    created = {}
    cls_name = f"TEST_Class_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{API}/classes", json={"name": cls_name, "section": "A", "academic_year": "2025-26"}, headers=admin_headers)
    assert r.status_code == 200, r.text
    created["class"] = r.json()

    r = requests.post(f"{API}/students", json={
        "name": f"TEST_Student_{uuid.uuid4().hex[:5]}",
        "class_id": created["class"]["id"],
        "roll_no": "1",
        "guardian_name": "TG",
        "guardian_phone": "9999",
    }, headers=admin_headers)
    assert r.status_code == 200, r.text
    created["student"] = r.json()

    r = requests.post(f"{API}/fee-components", json={
        "name": f"TEST_Tuition_{uuid.uuid4().hex[:5]}",
        "frequency": "monthly",
        "default_amount": 1000.0,
        "description": "monthly tuition",
    }, headers=admin_headers)
    assert r.status_code == 200, r.text
    created["fc"] = r.json()

    yield created

    # Teardown
    try:
        requests.delete(f"{API}/students/{created['student']['id']}", headers=admin_headers)
        requests.delete(f"{API}/fee-components/{created['fc']['id']}", headers=admin_headers)
        requests.delete(f"{API}/classes/{created['class']['id']}", headers=admin_headers)
    except Exception:
        pass


# ────────────────────────────────────────────
# Auth
# ────────────────────────────────────────────
class TestAuth:
    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"username": "admin", "password": "wrong"})
        assert r.status_code == 401

    def test_login_valid(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_me(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers)
        assert r.status_code == 200
        u = r.json()
        assert u["username"] == "admin"
        assert u["role"] == "admin"
        assert "password_hash" not in u

    def test_me_unauth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ────────────────────────────────────────────
# Classes CRUD
# ────────────────────────────────────────────
class TestClasses:
    def test_class_crud_and_delete_blocked(self, admin_headers):
        r = requests.post(f"{API}/classes", json={"name": "TEST_C1", "section": "A"}, headers=admin_headers)
        assert r.status_code == 200
        cid = r.json()["id"]

        # list
        r = requests.get(f"{API}/classes", headers=admin_headers)
        assert r.status_code == 200
        assert any(c["id"] == cid for c in r.json())

        # update
        r = requests.put(f"{API}/classes/{cid}", json={"name": "TEST_C1x", "section": "B"}, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_C1x"

        # create student in class -> delete must be blocked
        s = requests.post(f"{API}/students", json={"name": "TEST_S", "class_id": cid}, headers=admin_headers)
        sid = s.json()["id"]
        rd = requests.delete(f"{API}/classes/{cid}", headers=admin_headers)
        assert rd.status_code == 400

        # delete student then class
        requests.delete(f"{API}/students/{sid}", headers=admin_headers)
        rd = requests.delete(f"{API}/classes/{cid}", headers=admin_headers)
        assert rd.status_code == 200


# ────────────────────────────────────────────
# Students CRUD
# ────────────────────────────────────────────
class TestStudents:
    def test_student_invalid_class(self, admin_headers):
        r = requests.post(f"{API}/students", json={"name": "TEST_x", "class_id": "nonexistent"}, headers=admin_headers)
        assert r.status_code == 400

    def test_student_get_update(self, admin_headers, seed):
        sid = seed["student"]["id"]
        r = requests.get(f"{API}/students/{sid}", headers=admin_headers)
        assert r.status_code == 200
        r = requests.put(f"{API}/students/{sid}", json={
            "name": seed["student"]["name"] + "_upd",
            "class_id": seed["class"]["id"],
        }, headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["name"].endswith("_upd")

    def test_students_filter_by_class(self, admin_headers, seed):
        r = requests.get(f"{API}/students", params={"class_id": seed["class"]["id"]}, headers=admin_headers)
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert seed["student"]["id"] in ids


# ────────────────────────────────────────────
# Fee components & overrides (priority)
# ────────────────────────────────────────────
class TestFeeStructure:
    def test_invalid_frequency(self, admin_headers):
        r = requests.post(f"{API}/fee-components", json={"name": "TEST_bad", "frequency": "weekly", "default_amount": 10}, headers=admin_headers)
        assert r.status_code == 400

    def test_priority_default(self, admin_headers, seed):
        # No overrides -> default 1000
        r = requests.get(f"{API}/students/{seed['student']['id']}/fee-structure", headers=admin_headers)
        assert r.status_code == 200
        item = next(i for i in r.json()["items"] if i["fee_component_id"] == seed["fc"]["id"])
        assert item["amount"] == 1000.0

    def test_priority_class_then_student(self, admin_headers, seed):
        fc_id = seed["fc"]["id"]
        cid = seed["class"]["id"]
        sid = seed["student"]["id"]

        # class override 800
        r = requests.post(f"{API}/fee-overrides", json={
            "fee_component_id": fc_id, "scope": "class", "scope_id": cid, "amount": 800.0,
        }, headers=admin_headers)
        assert r.status_code == 200
        r = requests.get(f"{API}/students/{sid}/fee-structure", headers=admin_headers)
        item = next(i for i in r.json()["items"] if i["fee_component_id"] == fc_id)
        assert item["amount"] == 800.0, "class override should apply"

        # student override 600 (higher priority)
        r = requests.post(f"{API}/fee-overrides", json={
            "fee_component_id": fc_id, "scope": "student", "scope_id": sid, "amount": 600.0,
        }, headers=admin_headers)
        assert r.status_code == 200
        r = requests.get(f"{API}/students/{sid}/fee-structure", headers=admin_headers)
        item = next(i for i in r.json()["items"] if i["fee_component_id"] == fc_id)
        assert item["amount"] == 600.0, "student override must override class override"


# ────────────────────────────────────────────
# Discounts + invoices + payments
# ────────────────────────────────────────────
class TestBillingFlow:
    def test_full_flow(self, admin_headers, seed):
        sid = seed["student"]["id"]
        fc_id = seed["fc"]["id"]

        # ensure student override 600 (independent of other tests)
        r = requests.post(f"{API}/fee-overrides", json={
            "fee_component_id": fc_id, "scope": "student", "scope_id": sid, "amount": 600.0,
        }, headers=admin_headers)
        assert r.status_code == 200

        # component-scoped discount 100
        rd = requests.post(f"{API}/discounts", json={
            "student_id": sid, "fee_component_id": fc_id, "amount": 100.0, "reason": "TEST_scoped",
        }, headers=admin_headers)
        assert rd.status_code == 200
        d1 = rd.json()["id"]

        # general discount 50
        rd = requests.post(f"{API}/discounts", json={
            "student_id": sid, "amount": 50.0, "reason": "TEST_general",
        }, headers=admin_headers)
        assert rd.status_code == 200
        d2 = rd.json()["id"]

        # create invoice (student override = 600 from previous test; amount - 100 - 50 = 450)
        ri = requests.post(f"{API}/invoices", json={
            "student_id": sid, "frequency": "monthly", "period_label": "TEST_Jan26",
            "component_ids": [fc_id],
        }, headers=admin_headers)
        assert ri.status_code == 200, ri.text
        inv = ri.json()
        assert inv["subtotal"] == 600.0
        assert inv["total"] == 450.0
        assert inv["status"] == "pending"
        assert inv["invoice_number"].startswith("INV-")
        inv_id = inv["id"]

        # partial payment 200
        rp = requests.post(f"{API}/payments", json={"invoice_id": inv_id, "amount": 200.0, "method": "cash"}, headers=admin_headers)
        assert rp.status_code == 200
        pay1 = rp.json()
        assert pay1["receipt_number"].startswith("RCPT-") or "-" in pay1["receipt_number"]

        # check invoice partial
        r = requests.get(f"{API}/invoices/{inv_id}", headers=admin_headers)
        assert r.json()["status"] == "partial"
        assert r.json()["paid_amount"] == 200.0

        # overpayment reject
        rp = requests.post(f"{API}/payments", json={"invoice_id": inv_id, "amount": 9999.0}, headers=admin_headers)
        assert rp.status_code == 400

        # final payment 250 -> paid
        rp = requests.post(f"{API}/payments", json={"invoice_id": inv_id, "amount": 250.0}, headers=admin_headers)
        assert rp.status_code == 200
        r = requests.get(f"{API}/invoices/{inv_id}", headers=admin_headers)
        assert r.json()["status"] == "paid"

        # retrieve payment
        r = requests.get(f"{API}/payments/{pay1['id']}", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["receipt_number"] == pay1["receipt_number"]

        # cleanup discounts
        requests.delete(f"{API}/discounts/{d1}", headers=admin_headers)
        requests.delete(f"{API}/discounts/{d2}", headers=admin_headers)


# ────────────────────────────────────────────
# Settings
# ────────────────────────────────────────────
class TestSettings:
    def test_get_update_settings(self, admin_headers):
        r = requests.get(f"{API}/settings", headers=admin_headers)
        assert r.status_code == 200
        r = requests.put(f"{API}/settings", json={
            "school_name": "TEST School",
            "address": "T Addr",
            "phone": "1234",
            "email": "s@t.com",
            "logo_url": "",
            "receipt_header": "TEST Receipt",
            "receipt_footer": "TEST Footer",
            "show_logo": True,
            "show_signature_line": True,
            "receipt_prefix": "TRCPT",
            "currency_symbol": "₹",
        }, headers=admin_headers)
        assert r.status_code == 200
        r = requests.get(f"{API}/settings", headers=admin_headers)
        assert r.json()["school_name"] == "TEST School"
        assert r.json()["receipt_prefix"] == "TRCPT"


# ────────────────────────────────────────────
# Permissions matrix + role enforcement
# ────────────────────────────────────────────
class TestPermissions:
    def test_default_permissions(self, admin_headers):
        r = requests.get(f"{API}/permissions", headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert "permissions" in data
        assert "admin" in data["permissions"]
        assert "staff" in data["permissions"]

    def test_create_users_and_role_enforcement(self, admin_headers, seed):
        # create staff user
        staff_username = f"test_staff_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/users", json={
            "username": staff_username, "password": "staffpass", "name": "T Staff", "role": "staff",
        }, headers=admin_headers)
        assert r.status_code == 200, r.text
        staff_id = r.json()["id"]

        # principal user
        principal_username = f"test_princ_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/users", json={
            "username": principal_username, "password": "princpass", "name": "T Princ", "role": "principal",
        }, headers=admin_headers)
        assert r.status_code == 200
        princ_id = r.json()["id"]

        # login as staff
        r = requests.post(f"{API}/auth/login", json={"username": staff_username, "password": "staffpass"})
        assert r.status_code == 200
        staff_headers = {"Authorization": f"Bearer {r.json()['token']}"}

        # staff can view students
        r = requests.get(f"{API}/students", headers=staff_headers)
        assert r.status_code == 200

        # staff CANNOT delete student (default staff delete=False for students)
        r = requests.delete(f"{API}/students/{seed['student']['id']}", headers=staff_headers)
        assert r.status_code == 403

        # login as principal
        r = requests.post(f"{API}/auth/login", json={"username": principal_username, "password": "princpass"})
        princ_headers = {"Authorization": f"Bearer {r.json()['token']}"}

        # principal cannot manage users (edit)
        r = requests.post(f"{API}/users", json={
            "username": f"test_x_{uuid.uuid4().hex[:5]}", "password": "x", "name": "x", "role": "staff",
        }, headers=princ_headers)
        assert r.status_code == 403  # only admin can create users

        # Update permissions matrix: grant staff delete on students, then verify
        # First get current
        current = requests.get(f"{API}/permissions", headers=admin_headers).json()["permissions"]
        current["staff"]["students"]["delete"] = True
        r = requests.put(f"{API}/permissions", json={"permissions": current}, headers=admin_headers)
        assert r.status_code == 200

        # staff should now be able to delete (create a throwaway student)
        rs = requests.post(f"{API}/students", json={"name": "TEST_delme", "class_id": seed["class"]["id"]}, headers=admin_headers)
        sid_tmp = rs.json()["id"]
        r = requests.delete(f"{API}/students/{sid_tmp}", headers=staff_headers)
        assert r.status_code == 200

        # revoke and verify 403
        current["staff"]["students"]["delete"] = False
        requests.put(f"{API}/permissions", json={"permissions": current}, headers=admin_headers)
        rs = requests.post(f"{API}/students", json={"name": "TEST_delme2", "class_id": seed["class"]["id"]}, headers=admin_headers)
        sid_tmp = rs.json()["id"]
        r = requests.delete(f"{API}/students/{sid_tmp}", headers=staff_headers)
        assert r.status_code == 403
        requests.delete(f"{API}/students/{sid_tmp}", headers=admin_headers)

        # cleanup users
        requests.delete(f"{API}/users/{staff_id}", headers=admin_headers)
        requests.delete(f"{API}/users/{princ_id}", headers=admin_headers)


# ────────────────────────────────────────────
# Stats
# ────────────────────────────────────────────
class TestStats:
    def test_stats_shape(self, admin_headers):
        r = requests.get(f"{API}/stats", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ["total_students", "total_classes", "total_invoices", "total_pending_invoices", "collected_this_month", "collected_total", "outstanding"]:
            assert k in d
        assert isinstance(d["total_students"], int)
