export interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

export interface User {
  id: number;
  name: string;
  role: 'manager' | 'delivery';
  phone: string;
  base_latitude: number;
  base_longitude: number;
  service_radius_km: number;
}

/** What POST /api/auth/rider/login and GET /api/auth/rider/me return. */
export interface RiderSession {
  access_token: string;
  token_type: string;
  rider: User;
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
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  customer_latitude: number;
  customer_longitude: number;
  status: 'Pending' | 'Assigned' | 'Delivered';
  delivery_boy_id: number | null;
  offered_to_delivery_boy_id: number | null;
  offered_distance_km: number | null;
  created_at: string;
  items: OrderItem[];
}

export interface DeliveryDashboard {
  incoming_orders: Order[];
  active_order: Order | null;
  recent_orders: Order[];
}

export interface Message {
  id: number;
  phone: string;
  direction: 'inbound' | 'outbound';
  content: string;
  created_at: string;
}
