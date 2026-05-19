export interface CarBrand {
  id: string;
  name: string;
  name_ar: string | null;
  country: string | null;
  logo_url: string | null;
  is_active: boolean;
}

export interface CarModel {
  id: string;
  brand_id: string;
  name: string;
  name_ar: string | null;
  body_type: string | null;
  year_start: number | null;
  year_end: number | null;
  car_brands?: CarBrand;
}

export interface PartCategory {
  id: string;
  name: string;
  name_ar: string;
  parent_id: string | null;
  icon: string | null;
}

export interface Part {
  id: string;
  tenant_id: string | null;
  part_number: string;
  oem_number: string | null;
  barcode: string | null;
  name: string;
  name_ar: string;
  description: string | null;
  description_ar: string | null;
  category_id: string | null;
  brand: string | null;
  condition: "new" | "used" | "refurbished";
  unit: string;
  weight_kg: number | null;
  price_cost: number;
  price_retail: number;
  price_wholesale: number | null;
  tax_rate: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  part_categories?: PartCategory;
}

export interface PartCompatibility {
  id: string;
  part_id: string;
  car_model_id: string;
  year_from: number | null;
  year_to: number | null;
  engine_code: string | null;
  notes: string | null;
  car_models?: CarModel & { car_brands?: CarBrand };
}

export interface Inventory {
  id: string;
  part_id: string;
  warehouse_id: string;
  quantity: number;
  quantity_reserved: number;
  reorder_point: number;
  location_code: string | null;
  parts?: Part;
  warehouses?: Warehouse;
}

export interface Warehouse {
  id: string;
  name: string;
  name_ar: string | null;
  city: string | null;
  is_default: boolean;
  is_active: boolean;
}

export interface Customer {
  id: string;
  customer_type: "retail" | "wholesale" | "workshop";
  name: string;
  name_ar: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  balance: number;
  credit_limit: number;
  is_active: boolean;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  name_ar: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string;
  payment_terms: number;
  is_active: boolean;
  created_at: string;
}

export interface SalesOrder {
  id: string;
  order_number: string;
  customer_id: string | null;
  status: "draft" | "confirmed" | "picking" | "shipped" | "delivered" | "returned" | "cancelled";
  payment_status: "unpaid" | "partial" | "paid" | "refunded";
  payment_method: string | null;
  order_date: string;
  subtotal: number;
  discount: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  created_at: string;
  customers?: Customer;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  status: "draft" | "sent" | "confirmed" | "partial" | "received" | "cancelled";
  order_date: string;
  expected_date: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  created_at: string;
  suppliers?: Supplier;
}

export type OrderStatus = SalesOrder["status"];
export type PaymentStatus = SalesOrder["payment_status"];
