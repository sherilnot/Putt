export type UserRole = 'admin' | 'customer';

export type DietType = 'veg' | 'non-veg' | 'vegan';

export type MealTime = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired';

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
  category: MealTime;
  dietType: DietType;
  price: number;
  isAvailable: boolean;
  createdBy?: string;
}

export interface DeliverySlot {
  _id: string;
  label: string;
  mealTime: MealTime;
  startTime: string;
  endTime: string;
  maxOrders: number;
  isActive: boolean;
}

export interface MealSlotItem {
  mealTime: MealTime;
  foodItems: FoodItem[];
}

export interface DayMenuItem {
  dayName:
    | 'Monday'
    | 'Tuesday'
    | 'Wednesday'
    | 'Thursday'
    | 'Friday'
    | 'Saturday'
    | 'Sunday';
  date?: string;
  meals: MealSlotItem[];
}

export interface WeeklyMenu {
  _id: string;
  title: string;
  weekStartDate: string;
  weekEndDate?: string;
  selectionDeadline?: string;
  selectionDeadlineFormatted?: string;
  isPublished?: boolean;
  status?: 'draft' | 'published' | 'closed';
  days: DayMenuItem[];
  isActive: boolean;
}

export interface DailyMealChoice {
  dayName: string;
  date: string;
  breakfast?: string | FoodItem | null;
  lunch?: string | FoodItem | null;
  dinner?: string | FoodItem | null;
  deliverySlot?: string | DeliverySlot | null;
}

export interface CustomerWeeklySelection {
  _id?: string;
  weekStartDate: string;
  weekEndDate?: string;
  selections: DailyMealChoice[];
  isLocked: boolean;
  submittedAt?: string;
}

export interface UpcomingWeekOption {
  label: string;
  weekIndex: number;
  weekStartDate: string;
  weekEndDate: string;
  selectionDeadline: string;
  selectionDeadlineFormatted: string;
  isSelectionLocked: boolean;
  menuId?: string | null;
  title: string;
  isPublished: boolean;
  status: string;
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

export interface SelectedMeal {
  _id?: string;
  date: string;
  mealTime: MealTime;
  foodItem: FoodItem;
  deliverySlot: DeliverySlot;
  locked: boolean;
}

export interface Subscription {
  _id: string;
  customer: User;
  plan: SubscriptionPlan;
  startDate: string;
  endDate: string;
  status: SubscriptionStatus;
  stripeSubscriptionId?: string;
  selectedMeals: SelectedMeal[];
  defaultDeliverySlot?: DeliverySlot;
}

export interface Order {
  _id: string;
  customer: User;
  subscription: string | Subscription;
  date: string;
  mealTime: MealTime;
  foodItem: FoodItem;
  deliverySlot: DeliverySlot;
  deliveryAddress?: Address;
  status: OrderStatus;
  notes?: string;
  createdAt: string;
}

export interface DashboardStats {
  activeSubscribers: number;
  todaysOrders: number;
  pendingOrders: number;
  totalFoodItems: number;
}
