export type IngredientGroup = {
  group: string;
  items: string[];
};

export type Recipe = {
  id?: number;
  title: string;
  category: string;
  emoji: string;
  prep: string;
  bake: string;
  yield: string;
  difficulty: "Easy" | "Medium" | "Hard";
  ingredients: string[] | IngredientGroup[];
  steps: string[];
  notes?: string;
  created_at?: string;
};

export type Ingredient = {
  id?: number;
  name: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  low_stock_threshold: number;
  created_at?: string;
};

export type RecipeIngredient = {
  id?: number;
  recipe_id: number;
  ingredient_id: number;
  amount_required: number;
  unit: string;
  ingredient?: Ingredient;
};

export type OrderStatus = "Pending" | "In Progress" | "Completed" | "Cancelled";

export type OrderItem = {
  id?: number;
  order_id?: number;
  recipe_id: number;
  quantity: number;
  price_per_item: number;
  recipe?: Recipe;
};

export type Order = {
  id?: number;
  customer_name: string;
  status: OrderStatus;
  notes?: string;
  created_at?: string;
  order_items?: OrderItem[];
};

export const categoryColors: Record<string, string> = {
  Breads: "#c9b18a",
  Cookies: "#d4956a",
  Pastries: "#b8a89a",
  Cakes: "#c4a882",
  Bars: "#a08060",
};

export const difficultyDots: Record<string, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
};

export const CATEGORIES = ["Breads", "Cookies", "Pastries", "Cakes", "Bars"];
export const DIFFICULTIES = ["Easy", "Medium", "Hard"];
export const UNITS = ["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "pcs", "slice"];
export const ORDER_STATUSES: OrderStatus[] = ["Pending", "In Progress", "Completed", "Cancelled"];

export const statusColors: Record<OrderStatus, string> = {
  Pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  "In Progress": "bg-blue-100 text-blue-700 border-blue-200",
  Completed: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-red-100 text-red-600 border-red-200",
};