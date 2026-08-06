'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { Order, Product, User } from '../types';
import {
  CheckCircle,
  Clock,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';
import { authFetch } from '../lib/api';
import ProductsDashboard from './ProductsDashboard';

type Tab = 'orders' | 'products';

type ManagerDashboardProps = {
  headerActions?: React.ReactNode;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

export default function ManagerDashboard({ headerActions }: ManagerDashboardProps) {
  const { socket } = useSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('orders');

  // A failed request returns {"detail": "..."} -- assigning that object into
  // state used with .map()/.filter() throws during render and blanks the whole
  // console, including the logout button. Only ever store arrays.
  const loadList = <T,>(path: string, apply: (rows: T[]) => void) =>
    authFetch(path)
      .then(async response => {
        if (!response.ok) throw new Error(`${path} failed (${response.status})`);
        return response.json();
      })
      .then(data => apply(Array.isArray(data) ? data : []))
      .catch(error => {
        console.error(error);
        apply([]);
      });

  useEffect(() => {
    void loadList<Order>('/api/orders', setOrders);
    void loadList<Product>('/api/products', setProducts);
    void loadList<User>('/api/users', setUsers);

    if (socket) {
      socket.on('order:created', (order: Order) => {
        setOrders(prev => [order, ...prev]);
      });
      socket.on('order:updated', (updatedOrder: Order) => {
        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
      });
      socket.on('inventory:updated', () => {
        void loadList<Product>('/api/products', setProducts);
      });
      socket.on('product:updated', () => {
        void loadList<Product>('/api/products', setProducts);
      });
    }

    return () => {
      socket?.off('order:created');
      socket?.off('order:updated');
      socket?.off('inventory:updated');
      socket?.off('product:updated');
    };
  }, [socket]);

  const deliveryBoys = users.filter(u => u.role === 'delivery');

  const assignDelivery = async (orderId: number, deliveryBoyId: number) => {
    try {
      const response = await authFetch(`/api/orders/${orderId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_boy_id: deliveryBoyId })
      });
      if (response.ok) {
        setOrders(prev =>
          prev.map(o =>
            o.id === orderId
              ? { ...o, delivery_boy_id: deliveryBoyId, status: 'Assigned' as const }
              : o
          )
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm shadow-slate-900/20">
              <Warehouse className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">eDawr Admin</h1>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Operations Console</p>
            </div>
          </div>
          <nav className="panel flex flex-wrap gap-2 rounded-2xl p-1.5">
            <button
              onClick={() => setActiveTab('orders')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'orders' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              Orders
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'products' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
            >
              Products
            </button>
          </nav>
          {headerActions ? <div className="ml-auto">{headerActions}</div> : null}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === 'orders' ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-900">Live Orders</h2>
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-3 h-3 rounded-full bg-yellow-400"></span> Pending
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-3 h-3 rounded-full bg-blue-400"></span> Assigned
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="w-3 h-3 rounded-full bg-emerald-400"></span> Delivered
                </div>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {orders.map(order => (
                <div key={order.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 p-4">
                    <div className="font-mono text-sm font-medium text-slate-500">#{order.id.toString().padStart(4, '0')}</div>
                    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium
                      ${order.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'Assigned' ? 'bg-blue-100 text-blue-800' :
                        'bg-emerald-100 text-emerald-800'}`}>
                      {order.status === 'Pending' && <Clock className="w-3 h-3" />}
                      {order.status === 'Assigned' && <Truck className="w-3 h-3" />}
                      {order.status === 'Delivered' && <CheckCircle className="w-3 h-3" />}
                      {order.status}
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Customer</div>
                      <div className="text-sm font-medium text-slate-900">{order.customer_phone}</div>
                    </div>

                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Items</div>
                      <ul className="space-y-2">
                        {order.items?.map(item => (
                          <li key={item.id} className="flex justify-between text-sm">
                            <span className="text-slate-700">{item.quantity}x {item.name}</span>
                            <span className="font-mono text-slate-500">{formatCurrency(item.price * item.quantity)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-medium">
                        <span>Total</span>
                        <span>{formatCurrency(order.items?.reduce((acc, item) => acc + (item.price * item.quantity), 0) ?? 0)}</span>
                      </div>
                    </div>

                    {order.status === 'Pending' && (
                      <div className="border-t border-slate-100 pt-4">
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Assign Delivery</label>
                        <select
                          className="w-full rounded-lg border border-slate-300 p-2 text-sm shadow-sm focus:border-slate-900 focus:ring-slate-900"
                          onChange={(e) => {
                            if (e.target.value) assignDelivery(order.id, parseInt(e.target.value, 10));
                          }}
                          defaultValue=""
                        >
                          <option value="" disabled>Select delivery partner...</option>
                          {deliveryBoys.map(boy => (
                            <option key={boy.id} value={boy.id}>{boy.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {order.status !== 'Pending' && order.delivery_boy_id && (
                      <div className="border-t border-slate-100 pt-4">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Assigned To</div>
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                          <Users className="h-4 w-4 text-slate-400" />
                          {deliveryBoys.find(b => b.id === order.delivery_boy_id)?.name || 'Unknown'}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {orders.length === 0 && (
                <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-slate-500">
                  No orders yet.
                </div>
              )}
            </div>
          </div>
        ) : (
          <ProductsDashboard />
        )}
      </main>
    </div>
  );
}
