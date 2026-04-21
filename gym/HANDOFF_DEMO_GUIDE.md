# Demo & Handoff Guide

## 1. Recommended demo flow
### Admin
1. Log in as admin
2. Open Ratings & Reviews
3. Show reply / visibility / remove actions
4. Open analytics and point out alerts / maintenance prediction

### Trainer
1. Open a member profile
2. Create a workout plan
3. Create a meal plan with custom food
4. Open Trainer Analytics
5. Show member-wise meal adherence and proactive alerts

### Member
1. Log in as member
2. Open My Workout Plans and start an exercise
3. Finish & Save with difficulty/discomfort info
4. Open My Meal Plans and mark meal completion
5. Create a review and optionally flag another review
6. Show notifications bell for review-related updates

## 2. Test credentials
### Admin
- Email: `admin@gym.local`
- Password: `Admin@123`

### Trainer / Member
- Create through the app/admin flows or use existing MongoDB records in your local database.

## 3. Important demo talking points
- The system is role-based: admin, trainer, member.
- Workout plans are not static; they track progress and support progression suggestions.
- Meal plans include adherence tracking and substitution support.
- Reviews are actionable because admins can moderate and respond.
- Equipment usage is operationally meaningful because issue reports and maintenance prediction are included.
- Trainer analytics connect workout, meal, review, and equipment insight in one place.

## 4. Before demo day
- Confirm `backend/.env` and `frontend/.env` values
- Confirm MongoDB is running
- Seed food/exercise data if needed
- Test login for all required roles
- Clear stale browser storage if auth behaves oddly on web

## 5. Deployment warning
This project still contains local-development credentials in environment files. Replace them before sharing publicly.
