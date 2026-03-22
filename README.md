# Wadinoor Daily Umrah Service ERP

A production-ready full-stack ERP for managing Umrah trips, travelers, expenses, and financial reporting.

## Tech Stack
- Frontend: React (Vite), Tailwind CSS, shadcn/ui-style components, Recharts
- Backend: Node.js (Express)
- Database: SQLite with Prisma ORM
- Auth: JWT
- Reports: jsPDF, SheetJS

## Quick Start

1) Install dependencies

```bash
npm install
```

2) Configure environment

Copy the server env template and update as needed:

```bash
copy server\.env.example server\.env
```

3) Initialize the database

For a fresh database:

```bash
npm run prisma:migrate
npm run prisma:seed
```

For existing databases, apply migrations without prompting:

```bash
npm run prisma:deploy
```

4) Run the app

```bash
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:4000

## Default Users
- Admin: admin@wadi-noor.com / admin123
- Staff: staff@wadi-noor.com / staff123

## Project Structure
- `client` React app
- `server` Express API + Prisma

## Scripts
- `npm run dev` Start frontend and backend
- `npm run prisma:migrate` Run Prisma migrations (dev)
- `npm run prisma:deploy` Apply migrations (safe for production/existing data)
- `npm run prisma:seed` Seed sample data

## Notes
- Currency: SAR
- Reports: Passenger lists and financial summaries are exportable to PDF and Excel
