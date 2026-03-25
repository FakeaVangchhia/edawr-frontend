export interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  unit: string;
  price: number;
  cost_price: number;
  mrp: number;
  stock: number;
  reorder_level: number;
  status: string;
  location: string;
  supplier_name: string;
  supplier_phone: string;
  description: string;
  image_url: string;
}

export type Role = 'manager' | 'delivery'; // New type definition

export interface User {
  id: number;
  name: string;
  role: Role; // Updated: using the new Role type
  phone: string;
}

export interface Category { // New interface
  id: number;
  name: string;
  description: string;
  parent_id: number | null;
  status: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantity: number;
  name: string;
  price: number;
}

export interface Order {
  id: number;
  customer_phone: string;
  status: 'Pending' | 'Assigned' | 'Delivered';
  delivery_boy_id: number | null;
  created_at: string;
  items: OrderItem[];
}

export interface Message {
  id: number;
  phone: string;
  direction: 'inbound' | 'outbound';
  content: string;
  created_at: string;
}
