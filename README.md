# Puttum Kadalayum
### Weekly Kerala meal orders with daily pickup (Australia)

Each week the manager picks 3 dishes for every day of the following week. Customers then order 0 to 3 meals a day from those dishes (quantities allowed), pick one pickup time per day, and collect their meals from the mess. Each customer's week becomes a bill (the dish prices added up), paid to the manager offline (cash, bank transfer or PayID) and marked paid in the app.

**Weekly timeline** (Sydney time), for the week starting Monday 16 Nov:
- Sun 8 Nov – Mon 9 Nov 11:59 PM: the manager sets the menu.
- Wed 11 Nov – Thu 12 Nov 11:59 PM: customers order.

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
1. **Today**: meals to serve, a cook list (how many of each dish), progress per pickup window, a reminder to set the menu, and bills still to collect.
2. **Menu**: up to 3 dishes for each day of the coming week.
3. **Dishes**: add dishes, set prices, mark them sold out, or remove them.
4. **Kitchen**: today's meals grouped by pickup time; move each order through Preparing → Ready for pickup → Collected (the customer is notified).
5. **Bills**: every customer's order and total for a week; mark each bill paid (cash, bank transfer or PayID).

### Customer
1. **Order**: for each day of next week, 0 to 3 meals from that day's dishes and one pickup time, with a running bill.
2. **Bills**: each week's bill, what's owed, and what's been paid.
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
- `render.yaml` defines the API service. Set `MONGO_URI`, `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Render; the first start creates the manager account and pickup windows.
- `mobile/eas.json` points app builds at the hosted API.
