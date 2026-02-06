# Solar Calculator Platform

**Complete solar project management system with FEOC compliance checking, parts catalog, and project comparison tools.**

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Project Structure](#project-structure)
4. [Development Setup](#development-setup)
5. [Docker Deployment](#docker-deployment)
6. [Features](#features)
7. [API Documentation](#api-documentation)
8. [Environment Configuration](#environment-configuration)
9. [Troubleshooting](#troubleshooting)
10. [Database Management](#database-management)

---

## 🎯 Overview

This platform provides solar developers with comprehensive tools to:

- ✅ **Manage Parts Catalog** - Search, add, edit solar components with origin tracking
- ✅ **FEOC Compliance** - Calculate Foreign Entity of Concern compliance for 2026+ IRA requirements
- ✅ **Project Management** - Create, track, and archive solar projects
- ✅ **Component Comparison** - Compare parts pricing and compliance across projects
- ✅ **Admin Dashboard** - Professional management interface for developers
- ✅ **Customer Portal** - Client-facing solar project tools

### Technology Stack

- **Backend:** Node.js + Express + Prisma ORM
- **Frontend:** Next.js (Main Project) + React/Vite (Admin Dashboard)
- **Database:** MySQL
- **Deployment:** Docker + Docker Compose

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Docker Desktop** (for containerized deployment)
- **Git**
- **MySQL** (if running locally without Docker)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd Solar
   ```

2. **Install all dependencies:**
   ```bash
   npm run install:all
   ```

3. **Configure environment:**
   ```bash
   # Backend environment (required)
   cp backend/.env.example backend/.env
   # Edit backend/.env with your database credentials
   ```

4. **Start development servers:**
   ```bash
   npm run dev:all
   ```

   This starts:
   - 🔧 Backend API: `http://localhost:3000`
   - 📊 Admin Dashboard: `http://localhost:4000` ← **START HERE**
   - 🌞 Main Solar Project: `http://localhost:5173`

5. **Access the application:**
   - Open browser to **http://localhost:4000** (Admin Dashboard)
   - Click "Launch Solar Project" to access main application

---

## 📁 Project Structure

```
Solar/
├── backend/                    # Express API + Prisma ORM
│   ├── src/                   # API routes & logic
│   │   ├── server.js         # Main Express server
│   │   ├── avl.js           # 2026 AVL compliance checking
│   │   ├── feoc.js          # FEOC calculation engine
│   │   ├── compare.js       # Project comparison logic
│   │   └── materialsCatalog.js
│   ├── prisma/               # Database schema & migrations
│   │   ├── schema.prisma    # Database models
│   │   └── seed-from-xlsx.js
│   ├── data/                 # Parts data & mappings
│   │   ├── extracted_spec_components.csv
│   │   ├── manufacturer-country-mapping.json
│   │   └── material list.xlsx
│   ├── scripts/              # Utility scripts
│   └── test/                 # Backend tests
│
├── frontend/                  # Next.js Main Solar Project
│   ├── app/                  # Next.js 13+ app directory
│   │   ├── feoc-calculator/  # FEOC compliance calculator
│   │   ├── projects/         # Project management
│   │   ├── project-archives/ # Past project archives
│   │   ├── compare/          # Component comparison
│   │   └── parts/            # Parts catalog browser
│   ├── styles/               # Global CSS
│   └── public/               # Static assets
│
├── free-react-tailwind-admin-dashboard/  # Admin Dashboard
│   ├── src/
│   │   ├── pages/           # Dashboard pages
│   │   ├── components/       # Reusable UI components
│   │   └── layout/          # Layout components
│   └── public/              # Dashboard assets
│
├── local/                    # Environment templates
│   ├── .env.example         # Template environment file
│   └── sim_archives.js      # Archive simulation
│
├── docker-compose.yml        # Full stack deployment
├── docker-compose.backend-only.yml
└── package.json             # Monorepo scripts
```

---

## 💻 Development Setup

### NPM Scripts (Monorepo)

```bash
# Development
npm run dev              # Start admin dashboard only (port 4000)
npm run dev:admin        # Start admin dashboard only
npm run dev:backend      # Start backend API only (port 3000)
npm run dev:frontend     # Start main project only (port 5173)
npm run dev:all          # Start everything concurrently

# Installation
npm run install:all      # Install dependencies for all services
npm run install:admin    # Install admin dashboard deps
npm run install:backend  # Install backend deps
npm run install:frontend # Install frontend deps

# Testing
npm run test:frontend    # Run frontend tests
npm run test:backend     # Run backend tests

# Docker
npm run docker:build     # Build Docker images
npm run docker:up        # Start Docker containers
npm run docker:down      # Stop Docker containers
npm run docker:logs      # View container logs
npm run docker:dev       # Build and start containers
```

### Port Configuration

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| **Admin Dashboard** | 4000 | http://localhost:4000 | **Primary entry point** - Developer management interface |
| **Backend API** | 3000 | http://localhost:3000 | REST API for data and calculations |
| **Main Solar Project** | 5173 | http://localhost:5173 | Customer-facing solar tools |
| **MySQL Database** | 3308 | localhost:3308 | Database (Docker only) |

### Development Workflow

1. **Start admin dashboard first:**
   ```bash
   npm run dev:all
   ```

2. **Access admin dashboard:**
   - Open http://localhost:4000
   - View system health, statistics, and parts catalog

3. **Launch main project:**
   - Click "Launch Solar Project" button in admin dashboard
   - Opens http://localhost:5173 in new tab

4. **Make changes:**
   - Edit files in `backend/`, `frontend/`, or `free-react-tailwind-admin-dashboard/`
   - Hot reload automatically applies changes

---

## 🐳 Docker Deployment

### Full Stack Deployment

```bash
# Build and start all services
docker-compose up --build

# Run in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

**Access URLs (Docker):**
- Frontend: http://localhost:3001
- Backend: http://localhost:3000
- Database: localhost:3308

### Backend-Only Deployment

```bash
docker-compose -f docker-compose.backend-only.yml up -d
```

### Docker Commands

```bash
# View running containers
docker ps

# Check container logs
docker logs solar-backend
docker logs solar-frontend

# Execute commands in container
docker exec -it solar-backend npm run seed

# Restart container
docker restart solar-backend

# Remove containers and volumes
docker-compose down -v
```

---

## ✨ Features

### 1. Admin Dashboard (Port 4000)

**Main Features:**
- 📊 System health monitoring
- 📈 Project statistics and analytics
- 🔧 Parts catalog management
- 📁 Project archives browser
- 🧮 Built-in FEOC calculator
- 🔗 Launch button to main solar project

**Access:** http://localhost:4000

### 2. Main Solar Project (Port 5173)

**FEOC Calculator:**
- 2026+ IRA Foreign Entity of Concern compliance checking
- Prohibited countries: China (CN), Russia (RU), North Korea (KP), Iran (IR)
- Steel/Iron vs Manufactured Products categorization
- Compliance recommendations and AVL-approved alternatives

**Project Management:**
- Create and manage solar projects
- Track customer information and system specifications
- Archive completed projects
- Load templates from project archives

**Parts Catalog:**
- Search and filter solar components
- Country of origin tracking
- Domestic vs Foreign classification
- Pricing and manufacturer details

**Component Comparison:**
- Compare parts across projects
- Cost analysis and compliance scoring
- Side-by-side feature comparison

**Export Tools:**
- FEOC vendor template generation
- Project reports in JSON format
- Compliance documentation

### 3. Backend API (Port 3000)

**Core Endpoints:**

```bash
# Health & Info
GET /health          # API health check
GET /info           # Available routes

# Parts Search
GET /search?q=panel&page=1&page_size=20

# FEOC Compliance
POST /feoc/evaluate  # Calculate FEOC compliance
GET /feoc/template   # Download vendor template
POST /feoc/import    # Import vendor response

# Projects & Comparison
GET /compare/projects?page=1&per_page=10
GET /compare/:designId

# 2026 AVL Compliance
GET /avl/modules     # 2026-approved solar panels
GET /avl/inverters   # 2026-approved inverters
GET /avl/search?q=hyundai

# Parts Management
GET /parts?page=1&limit=50
POST /parts          # Add new part
PUT /parts/:id       # Update part
DELETE /parts/:id    # Delete part

# Metrics
GET /metrics         # Get system metrics
POST /metrics/event  # Track event
```

---

## ⚙️ Environment Configuration

### Backend Environment (`backend/.env`)

```env
# Database (MySQL)
DATABASE_URL="mysql://solar_user:solar_password@localhost:3308/solar_db"

# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Settings
FRONTEND_ORIGIN=http://localhost:5173

# Aurora API (Optional - for external integrations)
# AURORA_TENANT_ID=your_tenant_id
# AURORA_API_TOKEN=your_api_token

# Security
# SESSION_SECRET=your_secure_session_secret
```

### Docker Environment

For Docker deployment, use `local/.env.production`:

```env
DATABASE_URL="mysql://solar_user:solar_password@db:3306/solar_db"
PORT=3000
NODE_ENV=production
FRONTEND_ORIGIN=http://localhost:3001
```

### Frontend Environment (Optional)

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### Environment Files Security

- ✅ **Commit:** `.env.example`
- ❌ **Never commit:** `.env`, `.env.local`, `.env.development`, `.env.production`
- 🔒 All sensitive `.env` files are in `.gitignore`

---

## 🔧 Troubleshooting

### Port Conflicts

If ports 3000, 4000, or 5173 are already in use:

```bash
# Windows - Check what's using the port
netstat -ano | findstr :4000
netstat -ano | findstr :5173
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <process_id> /F

# Linux/Mac - Check and kill
lsof -ti:4000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### Database Connection Issues

```bash
# Check if MySQL is running (Docker)
docker ps | grep mysql

# View database logs
docker logs solar-db

# Reset database
docker-compose down -v
docker-compose up -d
```

### Backend Won't Start

```bash
# Check for errors
cd backend
npm run dev

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check Prisma client
npx prisma generate
```

### Frontend Build Errors

```bash
# Clear Next.js cache
cd frontend
rm -rf .next
npm run dev

# Clear Vite cache
cd free-react-tailwind-admin-dashboard
rm -rf dist node_modules/.vite
npm run dev
```

### Docker Issues

```bash
# Remove all containers and rebuild
docker-compose down -v
docker-compose up --build

# Check Docker logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild specific service
docker-compose up -d --build backend
```

### "Failed to Load Parts" Error

This usually means the backend isn't running:

1. Check backend is running: http://localhost:3000/health
2. Restart backend: `npm run dev:backend`
3. Check browser console for CORS errors
4. Verify `vite.config.ts` proxy configuration

---

## 🗄️ Database Management

### Prisma Commands

```bash
# Generate Prisma client
cd backend
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Open Prisma Studio (GUI)
npx prisma studio

# Reset database (WARNING: Deletes all data)
npx prisma migrate reset
```

### Seeding Data

```bash
# Seed from Excel file
cd backend
npm run seed

# Seed specific data
node prisma/seed-from-xlsx.js
node prisma/seed-component-maps.js

# Reset and seed
npm run reset-seed
```

### Direct Database Access

```bash
# MySQL CLI (Docker)
docker exec -it solar-db mysql -u solar_user -p solar_db

# MySQL Workbench
Host: localhost
Port: 3308
User: solar_user
Password: solar_password
Database: solar_db
```

### Backup & Restore

```bash
# Backup database
docker exec solar-db mysqldump -u solar_user -p solar_db > backup.sql

# Restore database
docker exec -i solar-db mysql -u solar_user -p solar_db < backup.sql
```

---

## 📚 Additional Information

### FEOC Compliance (IRA 2026 Requirements)

**What is FEOC?**
- Foreign Entity of Concern per IRA Section 13501
- Effective January 1, 2026 for solar installations
- 0% content allowed from: China, Russia, North Korea, Iran

**Compliance Categories:**
1. **Steel/Iron Components:** Racking, mounting, structural materials
2. **Manufactured Products:** Panels, inverters, batteries

**Using the FEOC Calculator:**
1. Navigate to FEOC Calculator page
2. Add project components with quantities
3. Click "Check FEOC Compliance"
4. Review compliance report and recommendations
5. Export report for documentation

### 2026 AVL (Approved Vendors List)

The platform includes built-in 2026 AVL compliance checking:

**Approved Panel Manufacturers:**
- Hyundai Energy Solutions
- QCells (Q.CELLS)
- REC Solar
- Silfab Solar
- Meyer Burger
- Mission Solar

**Approved Inverter Manufacturers:**
- Enphase Energy
- SolarEdge Technologies
- SMA America
- Generac (PWRcell)

### Parts Data Management

**Adding New Parts:**
1. Use admin dashboard or API endpoint
2. Include: SKU, name, manufacturer, price, origin country
3. System auto-classifies as domestic/foreign/FEOC

**Bulk Import:**
- Update `backend/data/material list.xlsx`
- Run `npm run seed` to import

**Country Mapping:**
- Edit `backend/data/manufacturer-country-mapping.json`
- Maps manufacturers to origin countries

---

## 🤝 Contributing

### Code Style

- Use ES6+ JavaScript/TypeScript
- Follow existing code structure
- Add comments for complex logic
- Write tests for new features

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "Add: your feature description"

# Push and create PR
git push origin feature/your-feature-name
```

### Testing

```bash
# Run all tests
npm run test:backend
npm run test:frontend

# Run specific test file
cd backend
npm test -- smoke.test.js
```

---

## 📞 Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review error logs: `docker-compose logs -f`
3. Check API health: http://localhost:3000/health
4. Verify environment configuration

---

## 📄 License

Licensed under MIT. See `free-react-tailwind-admin-dashboard/LICENSE.md`.

---

**Ready to build? Start here:**

```bash
npm run install:all
npm run dev:all
# Open http://localhost:4000
```

🌞 **Happy Solar Calculating!**
