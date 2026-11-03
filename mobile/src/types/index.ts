export type UserRole = 'admin' | 'customer';

export type DietType = 'veg' | 'non-veg' | 'vegan';

// Meals are collected from the mess: pending → preparing → ready → collected
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'collected' | 'cancelled';

export type SubscriptionStatus = 'pending' | 'active' | 'paused' | 'cancelled' | 'expired';

export type DayName =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface Address {
  street?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  address?: Address;
  messId?: string;
}

export interface FoodItem {
  _id: string;
  name: string;
  description: string;
  imageUrl?: string;
  dietType: DietType;
  price: number;
  isAvailable: boolean;
  createdBy?: string;
}

// A time window in which customers collect their meals from the mess
export interface PickupSlot {
  _id: string;
  label: string;
  startTime: string;
  endTime: string;
  maxOrders: number;
  isActive: boolean;
}

export interface DayChoice {
  dayName: DayName;
  date?: string;
  meals: string[]; // FoodItem ids, up to the plan's meals per day
  pickupSlot: string | null;
}

export interface CustomerWeeklySelection {
  _id?: string;
  weekStartDate: string;
  weekEndDate?: string;
  days: DayChoice[];
  submittedAt?: string;
}

// GET /customer/week
export interface WeekPlan {
  weekStartDate: string;
  weekEndDate: string;
  selectionDeadline: string;
  selectionDeadlineFormatted: string;
  isLocked: boolean;
  dishes: FoodItem[];
  pickupSlots: PickupSlot[];
  mealsPerDay: number | null; // null when not signed in or no active plan
  selection: CustomerWeeklySelection | null;
}

export interface SubscriptionPlan {
  _id: string;
  name: string;
  description: string;
  priceAUD: number;
  intervalDays: number;
  mealsPerDay: number;
  dietTypes: DietType[];
  isActive: boolean;
}

export type PaymentMethod = 'cash' | 'bank_transfer' | 'payid' | 'other';

export interface Payment {
  _id: string;
  amountAUD: number;
  method: PaymentMethod;
  reference?: string;
  periodStart: string;
  periodEnd: string;
  confirmedAt: string;
}

export interface Subscription {
  _id: string;
  customer: User;
  plan: SubscriptionPlan;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
  payments?: Payment[];
}

export interface Order {
  _id: string;
  customer: User;
  subscription: string | Subscription;
  date: string;
  mealNumber: number;
  foodItem: FoodItem;
  pickupSlot: PickupSlot;
  status: OrderStatus;
  notes?: string;
  createdAt: string;
}

export interface DashboardStats {
  activeSubscribers: number;
  todaysOrders: number;
  pendingOrders: number;
  totalFoodItems: number;
  awaitingPayment?: number;
}
