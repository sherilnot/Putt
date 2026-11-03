# Puttum Kadalayum
### Kerala mess meal subscriptions with daily pickup (Australia)

Customers subscribe to 1, 2 or 3 meals a day, choose next week's dishes by Thursday night, pick one pickup time per day, and collect their meals from the mess. Payment is made to the manager offline (cash, bank transfer or PayID) and confirmed in the app.

---

## Tech Stack
- **Mobile app**: React Native (Expo SDK 58), TypeScript, Expo Router, Zustand, Axios, Reanimated, react-native-svg
- **Backend API**: Node.js, Express, MongoDB (Mongoose), JWT auth, Helmet, CORS
- **Payments**: offline, confirmed by the manager in the app
- **Notifications**: Expo push notifications
- **Hosting**: Render (API) + MongoDB Atlas

---

## Features

### Manager
1. **Today**: meals to serve, a cook list (how many of each dish), progress per pickup window, and plan requests waiting for payment.
2. **Kitchen**: today's and tomorrow's meals grouped by pickup time; move each order through Preparing → Ready for pickup → Collected (the customer is notified).
3. **Dishes**: add dishes, mark them sold out, or remove them.
4. **Customers**: confirm payments (activates or renews a plan), pause or reactivate plans.

### Customer
1. **Plans**: 1, 2 or 3 meals a day, weekly or monthly. Requests stay pending until the manager confirms payment.
2. **My Meals**: for each day of next week, choose up to the plan's meals from any dish and one pickup time. Choices close Thursday 11:59 PM (Sydney time).
3. **Pickups**: upcoming and past meals with live status.

---

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env
npm run dev          # uses MongoDB from MONGO_URI, or an in-memory seeded database
npm test             # API integration tests
```
API runs at `http://localhost:5000`; health check at `/api/health`.

### Mobile
```bash
cd mobile
npm install
npx expo start
```
Without `EXPO_PUBLIC_API_URL` the app talks to the local backend and shows demo sign-in buttons.

### Demo accounts (local in-memory database only)
| Role | Email | Password |
|------|-------|----------|
| Manager | `admin@puttumkadalayum.com.au` | `Admin123!` |
| Customer | `customer@example.com` | `Customer123!` |

---

## Deployment
- `render.yaml` defines the API service. Set `MONGO_URI`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Render; the first start creates the manager account, default plans and pickup windows.
- `mobile/eas.json` points app builds at the hosted API.
