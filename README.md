# Smart Parking System

Database Lab project — Group 8.

- **Database:** MS SQL Server (`SmartParkingDB`)
- **Backend:** Spring Boot (Java, JdbcTemplate) — port `8080`
- **Frontend:** React + Vite + Tailwind

## Layout
- `schema.sql` — full DDL, views, and sample data
- `backend/` — Spring Boot REST API
- `frontend/` — React SPA

## Run

**Database**
```sql
-- in SQL Server, run schema.sql
```

**Backend**
```bash
cd backend
./mvnw spring-boot:run
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```
