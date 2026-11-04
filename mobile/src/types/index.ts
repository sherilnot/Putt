export type UserRole = 'admin' | 'customer';

export type DietType = 'veg' | 'non-veg' | 'vegan';

// Meals are collected from the mess: pending → preparing → ready → collected
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'collected' | 'cancelled';

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

export interface DayItem {
  foodItem: string;
  quantity: number;
  price?: number;
}

export interface DayChoice {
  dayName: DayName;
  date?: string;
  items: DayItem[]; // up to 3 meals in total
  pickupSlot: string | null;
}

export type PaymentMethod = 'cash' | 'bank_transfer' | 'payid' | 'other';

export interface BillPayment {
  status: 'unpaid' | 'paid';
  method?: PaymentMethod;
  reference?: string;
  paidAt?: string;
}

export interface CustomerWeeklySelection {
  _id?: string;
  weekStartDate: string;
  weekEndDate?: string;
  days: DayChoice[];
  totalAUD: number;
  payment?: BillPayment;
  submittedAt?: string;
}

// A week of meals with the dishes and customer filled in, as bills are returned
export interface Bill extends Omit<CustomerWeeklySelection, 'days'> {
  _id: string;
  customer: User;
  days: {
    dayName: DayName;
    date: string;
    items: { foodItem: FoodItem | null; quantity: number; price: number }[];
    pickupSlot: PickupSlot | null;
  }[];
  payment: BillPayment;
}

export interface MenuDay {
  dayName: DayName;
  date: string;
  dishes: FoodItem[];
}

// GET /customer/week
export interface WeekPlan {
  weekStartDate: string;
  weekEndDate: string;
  opensAt: string;
  selectionDeadline: string;
  selectionDeadlineFormatted: string;
  isOpen: boolean;
  isLocked: boolean;
  hasMenu: boolean;
  menuDays: MenuDay[];
  pickupSlots: PickupSlot[];
  maxMealsPerDay: number;
  selection: CustomerWeeklySelection | null;
}

// GET /admin/menu
export interface AdminMenu {
  weekStartDate: string;
  weekEndDate: string;
  opensAt: string;
  closesAt: string;
  deadlineFormatted: string;
  isOpen: boolean;
  isLocked: boolean;
  isSet: boolean;
  days: { dayName: DayName; date: string; dishes: string[] }[];
}

// GET /admin/bills
export interface BillsWeek {
  weekStartDate: string;
  weekEndDate: string;
  ordersOpen: boolean;
  ordersClosed: boolean;
  deadlineFormatted: string;
  summary: { bills: number; totalAUD: number; paidAUD: number; unpaidAUD: number };
  bills: Bill[];
}

export interface Order {
  _id: string;
  customer: User;
  date: string;
  mealNumber: number;
  foodItem: FoodItem;
  pickupSlot: PickupSlot;
  status: OrderStatus;
  notes?: string;
  createdAt: string;
}

export interface DashboardStats {
  customers: number;
  todaysOrders: number;
  pendingOrders: number;
  totalFoodItems: number;
  unpaidBills: number;
  menuWeekStartDate: string;
  menuSet: boolean;
  menuDeadline: string;
}
