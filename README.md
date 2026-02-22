# 🏢 RentMS — Tenant Management System

A production-ready full-stack tenant management system with JWT auth, role-based dashboards, rent billing, electricity calculation, and complaint tracking.

---

## 📁 Project Structure

```
tenant-management-system/
├── backend/
│   ├── server.js              # Express app + MongoDB connection + auto seed admin
│   ├── package.json
│   ├── .env.example
│   ├── middleware/
│   │   └── auth.js            # JWT protect, adminOnly, tenantOnly
│   ├── models/
│   │   ├── User.js            # Tenant + Admin model (bcrypt hashed password)
│   │   ├── Rent.js            # Monthly rent with electricity auto-calc
│   │   └── Complaint.js       # Tenant complaints
│   └── routes/
│       ├── auth.js            # Login, /me, change-password
│       ├── admin.js           # All admin APIs (tenants, rents, complaints, stats)
│       └── tenant.js          # Tenant-only APIs (own data only)
│
└── frontend/
    ├── index.html             # Landing page + Login
    ├── admin.html             # Admin dashboard
    ├── tenant.html            # Tenant dashboard
    ├── style.css              # Dark professional UI (Playfair Display + DM Sans)
    └── script.js             # Complete frontend logic (API, auth, CRUD, modals)
```

---

## 🚀 Quick Start (Local Development)

### 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret
npm run dev
```

### 2. Frontend Setup

Open `frontend/index.html` in browser, OR use VS Code Live Server.

**Default Admin Credentials:**
- Email: `admin@rentms.com`
- Password: `admin123`

---

## ⚙️ Environment Variables

```env
PORT=5000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/tenant-management
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production_min_32_chars
JWT_EXPIRE=7d
NODE_ENV=production
FRONTEND_URL=https://your-frontend.netlify.app
```

---

## 🌐 Deployment

### Backend → Render.com

1. Push backend folder to GitHub
2. Create new Web Service on Render
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add all environment variables in Render dashboard
6. Deploy → Copy your Render URL

### Frontend → Netlify

1. Edit `frontend/script.js` line ~14:
   ```js
   return 'https://your-rentms-backend.onrender.com/api';
   ```
2. Push frontend folder to GitHub
3. Connect to Netlify → Deploy

---

## 🔌 API Endpoints

### Auth
| Method | Route | Access |
|--------|-------|--------|
| POST | /api/auth/login | Public |
| GET | /api/auth/me | Private |
| PUT | /api/auth/change-password | Private |

### Admin
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/admin/stats | Dashboard stats |
| GET | /api/admin/tenants | List all tenants |
| POST | /api/admin/tenants | Add tenant |
| PUT | /api/admin/tenants/:id | Edit tenant |
| DELETE | /api/admin/tenants/:id | Delete tenant |
| GET | /api/admin/rents | List rents (filter by month/status) |
| POST | /api/admin/rents/generate | Generate monthly rent |
| PUT | /api/admin/rents/:id | Update rent |
| PATCH | /api/admin/rents/:id/status | Mark Paid/Unpaid |
| DELETE | /api/admin/rents/:id | Delete rent |
| GET | /api/admin/complaints | List complaints |
| PUT | /api/admin/complaints/:id | Resolve/update complaint |

### Tenant
| Method | Route | Description |
|--------|-------|-------------|
| GET | /api/tenant/dashboard | Own summary |
| GET | /api/tenant/rents | Own rent history |
| GET | /api/tenant/rents/current | Current month bill |
| GET | /api/tenant/complaints | Own complaints |
| POST | /api/tenant/complaints | Submit complaint |

---

## ✨ Features

**Admin:**
- Dashboard with live stats (collection, pending, tenant count, complaints)
- Add / Edit / Delete tenants
- Generate monthly rent with electricity billing
  - Enter previous + current meter units
  - Auto calculates: units consumed × ₹10 = electricity
  - Total = base rent + electricity
- Mark rent as Paid / Unpaid (one-click)
- Filter rents by month and status
- View/resolve all tenant complaints with admin notes

**Tenant:**
- Current month bill card (base rent + electricity + total + status)
- Full rent payment history
- Submit complaints by category + priority
- Track complaint status (Pending → In Progress → Resolved)
- See admin responses on resolved complaints

**Security:**
- JWT authentication (7-day expiry)
- bcrypt password hashing (12 rounds)
- Role-based route protection
- Tenant data isolation (can only see own data)
- CORS configured for specific origins

---

## 🎨 UI/UX

- Dark professional theme with gold accents
- Playfair Display + DM Sans typography
- Responsive (mobile sidebar toggle)
- Animated bill preview with live calculations
- Toast notifications
- Modal dialogs
- Empty states
- Loading screens
