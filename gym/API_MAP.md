# API Map

Base URL: `http://<host>:5000`

## Health
- `GET /health` — health check

## Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `GET /api/auth/me`

## Admin
- `GET /api/admin/...` — admin dashboard and management endpoints

## Trainer
- `GET /api/trainer/...` — trainer member/profile/plan related endpoints

## Member
- `GET /api/member/...`
- `POST /api/member/workouts/start`
- `PUT /api/member/workouts/:id/end`
- additional member notification/profile/workout flows under `/api/member`

## Workout Plans
- `GET /api/workout-plans/exercises`
- `POST /api/workout-plans`
- `GET /api/workout-plans/member/:memberId`
- `GET /api/workout-plans/:id`
- `PUT /api/workout-plans/:id`
- `DELETE /api/workout-plans/:id`

## Meal Plans
- `GET /api/meal-plans/foods`
- `POST /api/meal-plans/foods`
- `PUT /api/meal-plans/foods/:id`
- `POST /api/meal-plans`
- `GET /api/meal-plans/member/:memberId`
- `GET /api/meal-plans/:id`
- `PUT /api/meal-plans/:id`
- `DELETE /api/meal-plans/:id`
- adherence and substitution helper endpoints are under this route group in the merged build

## Reviews
- `GET /api/reviews`
- `GET /api/reviews/summary`
- `POST /api/reviews`
- `POST /api/reviews/:id/report`
- `PUT /api/reviews/:id/reply`
- `PUT /api/reviews/:id/status`
- `DELETE /api/reviews/:id`

## Equipment / Equipment Sessions
- `GET /api/equipment-sessions`
- `GET /api/equipment-sessions/dashboard/stats`
- `POST /api/equipment-sessions`
- `PUT /api/equipment-sessions/:id`
- `DELETE /api/equipment-sessions/:id`
- `POST /api/equipment-sessions/sessions/start`
- `PUT /api/equipment-sessions/sessions/:sessionId/end`

## Trainer Analytics / Member Plans
- `GET /api/member-plans`
- `GET /api/member-plans/analytics`
- merged build includes workout, meal, review, equipment, alert, and maintenance summary data in analytics

## Other existing route groups preserved
- `/api/booking`
- `/api/scheduling`
- `/api/tutorials`

## Notes
- Most trainer/member/admin routes require Bearer auth.
- Some review summary/public review routes allow optional auth.
- Exact request/response shapes are implemented in the frontend API files under `frontend/lib/`.
