# Scholaris — School Management ERP

## Original problem statement
Build me a simple school management app. I need class wise student database management and student fee management with customizable monthly, quarterly, yearly and one-time fee components. Fee component values can be specified universally, class wise or student specific. I need admin, principal & staff user roles with customizable permissions for view, edit & delete various types of data entries. Need customizable fee receipt format. I also need facility to add special fee discount for specific students.

## User choices
- Auth: simple username + password (no email) — JWT (Bearer token in localStorage)
- Currency: INR (₹)
- Classes: added manually via UI
- Receipts: both PDF download + printable view
- Discounts: fixed amount only

## Architecture
- Backend: FastAPI (`/app/backend/server.py`, single file) + MongoDB (motor)
- Frontend: React 19 + React Router + Tailwind + shadcn/ui + lucide-react + jspdf/html2canvas
- Design system: Swiss / high-contrast monochrome with #002FA7 accent, Cabinet Grotesk + IBM Plex

## MVP delivered — 2026-02-05
- Auth: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` (JWT Bearer)
- Seeded admin (`admin` / `admin123`) on startup
- Roles: `admin`, `principal`, `staff` with editable permission matrix at `/api/permissions`
- Classes CRUD (`/api/classes`) with student-count protection on delete
- Students CRUD (`/api/students`) with class filter, search
- Fee components CRUD (`/api/fee-components`) — monthly / quarterly / yearly / one_time
- Fee overrides (`/api/fee-overrides`) — class-scoped and student-scoped; resolution priority: student > class > default
- Discounts (`/api/discounts`) — fixed-amount, general or per-component
- Invoices (`/api/invoices`) — generate per student per period, correctly apply overrides + discounts
- Payments (`/api/payments`) — record collection, auto-transition invoice status pending → partial → paid
- Receipt view at `/receipts/:id/print` with browser print + jsPDF download
- Customizable school info + receipt template at `/api/settings` (title, footer, prefix, logo, signature line toggle)
- Dashboard stats at `/api/stats` (students, classes, pending, outstanding, collections)
- Admin can create/edit users at `/api/users` and edit permissions at `/api/permissions`

## Frontend pages
- `/login`, `/`, `/classes`, `/students`, `/students/:id`, `/fee-components`, `/discounts`, `/invoices`, `/receipts`, `/receipts/:id/print`, `/users`, `/permissions`, `/settings`

## Testing
- All 16 backend pytest cases pass, full UI e2e Playwright flow passes (login → class → student → fee → invoice → payment → receipt → permissions).

## Backlog (P1 / P2)
- P1: student photo upload (object storage), attendance module, bulk invoice generation for a whole class
- P1: SMS/Email receipt delivery to guardian
- P2: percentage-based discounts, scholarships, fee reminders, exam / marks module
- P2: multi-branch / academic-year switching, export ledger as CSV/Excel
- P2: fine/late-fee automation
- P2: refactor `server.py` into modular routers, add TTL cache for permissions map, race-safe receipt numbering (atomic counter)

## Credentials
See `/app/memory/test_credentials.md`.
