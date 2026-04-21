# Gym Management System — Final Handoff

This repository contains the merged gym management project with upgraded workout plans, meal plans, ratings & reviews, equipment tracking, analytics, and production-readiness improvements.

## Included apps
- `backend/` — Express + MongoDB API
- `frontend/` — Expo / React Native app (web + mobile)

## Demo test credentials
Use these for local demo/testing only:

- **Admin**
  - Email: `admin@gym.local`
  - Password: `Admin@123`

Notes:
- The backend `.env` also includes mail and OAuth values from local development. Change them before any real deployment.
- Trainer/member demo users depend on the users in your MongoDB database. Create them through the app or admin flows if needed.

## Main feature list
### Core platform
- Authentication with role-based navigation
- Admin / Trainer / Member dashboards
- Scheduling, bookings, tutorials, and existing gym flows preserved

### Workout plans
- Trainer-created workout plans
- Exercise library integration
- Member workout schedule and progress tracking
- Finish-quality logging (difficulty, discomfort, pain note)
- Progression suggestions
- Proactive trainer alerts for poor adherence / pain patterns

### Meal plans
- Trainer-created meal plans with food library
- Custom foods and meal slots
- Meal completion tracking: completed / partial / skipped
- Daily and recent adherence insight
- Substitution suggestions: balanced / high-protein / budget / local
- Trainer member-wise adherence analytics

### Ratings & reviews
- Public/member reviews with ratings and categories
- Member flag/report flow
- Admin reply / remove / visibility moderation
- Notifications for review actions
- Category-aware review analytics

### Equipment
- Equipment CRUD and availability tracking
- Equipment session start/end flow
- Maintenance-risk prediction and usage analytics

### Analytics & stability
- Trainer analytics dashboard
- Proactive trainer alerts
- Equipment maintenance prediction cards
- Improved auth persistence / live auth sync
- Safer API error handling and health endpoint

## Quick setup
### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm start -- --clear
```

## Required environment values
### Backend `.env`
At minimum verify:
- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `ADMIN_DEFAULT_EMAIL`
- `ADMIN_DEFAULT_PASSWORD`
- `CORS_ORIGIN` (optional but recommended for production)

### Frontend `.env`
At minimum verify:
- `EXPO_PUBLIC_API_URL`
- Google client IDs if Google sign-in is used
- default admin values for quick demo login

## Local API URL examples
- Android emulator: `http://10.0.2.2:5000`
- iOS simulator / local web: `http://localhost:5000`
- Real phone on same network: `http://YOUR-PC-IP:5000`

## Seed data
If you want starter exercise/food data:
```bash
cd backend
node seed-plans.js
```

## Documentation included
- `HANDOFF_DEMO_GUIDE.md`
- `API_MAP.md`
- `SCREENSHOTS_CHECKLIST.md`

## Final note
This is the final merged and upgraded project bundle. Before public deployment, rotate secrets and review mail/OAuth credentials.
