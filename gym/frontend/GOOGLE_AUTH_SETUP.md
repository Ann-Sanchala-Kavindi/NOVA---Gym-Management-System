# Google Auth Setup (Expo + Node backend)

This project already includes backend endpoint `POST /api/auth/google`.

## 1) Create Google OAuth client IDs

In Google Cloud Console:

1. Create/select a project.
2. Configure OAuth consent screen.
3. Create OAuth client IDs:
   - Web client ID (required for ID token verification)
   - Android client ID (if building Android app)
   - iOS client ID (if building iOS app)
4. Copy the **Web Client ID** into backend `.env` as `GOOGLE_CLIENT_ID`.

## 2) Backend env

In backend `.env`:

- `GOOGLE_CLIENT_ID=<your-web-client-id>`
- `JWT_SECRET=<long-random-secret>`

Restart backend after changing env values.

## 3) Frontend env

In frontend `.env` set:

- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web-client-id>`
- `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<android-client-id>`
- `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<ios-client-id>`

The login and register Google buttons now open Google auth, then send the returned `idToken` to `POST /api/auth/google` automatically.

Restart Expo after env changes:

`npx expo start --clear`

## 4) Frontend dependencies

Install:

- `expo-auth-session`

Command:

pnpm add expo-auth-session

## 5) Frontend implementation flow

In login/register screen:

1. Start Google auth request using `expo-auth-session/providers/google`.
2. On success, get `idToken` from response.
3. Send token to backend:
   - `POST /api/auth/google`
   - body: `{ "idToken": "..." }`
4. Save returned app token (JWT) and continue to authenticated screens.

## 6) Local testing notes

- Android emulator cannot use `localhost` for backend. Use `http://10.0.2.2:5000`.
- iOS simulator can use `http://localhost:5000`.
- Real devices must use your PC local network IP.

## 7) Security notes

- Do not trust email from client directly; always verify Google ID token server-side (already done).
- In production, use HTTPS and secure token storage.
- Do not expose JWT secret in frontend.
