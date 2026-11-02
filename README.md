# Puttum Beefum 🍛
### Kerala Mess & Daily Meal Subscriptions (Australia)

A complete full-stack mess management and meal subscription platform tailored for Australia.

---

## 🌟 Tech Stack
- **Mobile App**: React Native (Expo SDK 51), TypeScript, Expo Router, Zustand, Axios
- **Backend API**: Node.js, Express, MongoDB (Mongoose), JWT Auth, Helmet, CORS
- **Payments**: Offline (cash, bank transfer, PayID), confirmed by the manager in the admin app
- **Notifications**: Expo Push Notifications

---

## 👥 Features by Role

### 👨‍🍳 Admin (Mess Owner)
1. **Live Dashboard**: Instant counts of active subscribers, today's meal orders, kitchen prep status, and total dishes.
2. **Weekly Menu Planner**: Configure rotating menus for Monday to Sunday across Breakfast, Lunch, and Dinner.
3. **Dish Catalog**: Create, update, or delete dishes, set prices in AUD, specify diet types (Veg, Non-Veg, Vegan), and toggle stock availability.
4. **Kitchen & Orders**: View all daily orders grouped by delivery time window, view customer addresses and contact numbers, and advance orders through stages (`Pending` ➔ `Preparing` ➔ `Out for Delivery` ➔ `Delivered`).
5. **Subscriber Management**: Track all active, paused, or cancelled meal subscribers, and confirm offline payments to activate or renew plans.

### 🍽️ Customer
1. **Browse Weekly Menu**: View rotating daily meals with dietary filters.
2. **Meal Selection**: Pick preferred dishes for any day with delivery window selection, protected by a 24-hour cutoff rule.
3. **Subscriptions**: Choose from flexible plans (e.g. Weekly Full Mess $140/wk, Weekly Lunch Only $65/wk, Monthly Feast $490/mo) in AUD. Pay the manager offline; the plan starts once they confirm payment.
4. **Order Tracking**: Monitor real-time status of scheduled deliveries.
5. **Account & Delivery**: Set Australian delivery address (NSW, VIC, QLD, WA, SA) and manage preferences.

---

## 🚀 Quick Start Guide

### 1. Start the Backend

```bash
cd backend
# Create environment file if not present
cp .env.example .env

# Seed initial database with dishes, plans, admin, and demo customer
npm run seed

# Run server with hot-reloading
npm run dev
```
Backend runs at `http://localhost:5000`. Health check at `http://localhost:5000/api/health`.

### 2. Start the Mobile App

```bash
cd mobile
npx expo start
```
- Press `i` to open iOS Simulator
- Press `a` to open Android Emulator
- Scan the QR code using Expo Go on your physical phone

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin (Mess Owner)** | `admin@puttumbeefum.com.au` | `Admin123!` |
| **Customer** | `andi@example.com.au` | `Customer123!` |

*(Both accounts are pre-seeded and available with one-tap buttons on the app's login screen!)*
