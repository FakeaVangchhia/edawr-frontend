import React, { useEffect, useMemo, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { Message, Order, Product, User } from '../types';
import {
  BadgeDollarSign,
  Box,
  CheckCircle,
  Clock,
  Image as ImageIcon,
  Layers3,
  MapPin,
  MessageSquare,
  Package,
  Search,
  Send,
  ShieldCheck,
  Truck,
  Users,
  Warehouse,
} from 'lucide-react';

type TabKey = 'orders' | 'inventory' | 'whatsapp';

type ProductFormState = {
  name: string;
  sku: string;
  category: string;
  brand: string;
  unit: string;
  price: string;
  cost_price: string;
  mrp: string;
  stock: string;
  reorder_level: string;
  status: string;
  location: string;
  supplier_name: string;
  supplier_phone: string;
  description: string;
  image_url: string;
};

const emptyProductForm = (): ProductFormState => ({
  name: '',
  sku: '',
  category: 'General',
  brand: '',
  unit: 'unit',
  price: '',
  cost_price: '',
  mrp: '',
  stock: '',
  reorder_level: '10',
  status: 'Active',
  location: '',
  supplier_name: '',
  supplier_phone: '',
  description: '',
  image_url: '',
});

const stockBadgeClass = (product: Product) => {
  if (product.stock <= 0) return 'bg-rose-100 text-rose-700';
  if (product.stock <= product.reorder_level) return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
};

const stockLabel = (product: Product) => {
  if (product.stock <= 0) return 'Out of stock';
  if (product.stock <= product.reorder_level) return 'Reorder soon';
  return 'Healthy';
};

const marginPercent = (product: Product) => {
  if (!product.price) return 0;
  return ((product.price - product.cost_price) / product.price) * 100;
};

export default function ManagerDashboard() {
  const { socket } = useSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('orders');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [inventoryQuery, setInventoryQuery] = useState('');
  const [isSubmittingProduct, setIsSubmittingProduct] = useState(false);
  const [isUploadingProductImage, setIsUploadingProductImage] = useState(false);
  const [productImageError, setProductImageError] = useState('');

  useEffect(() => {
    fetch('/api/orders').then(r => r.json()).then(setOrders);
    fetch('/api/products').then(r => r.json()).then(setProducts);
    fetch('/api/users').then(r => r.json()).then(setUsers);
    fetch('/api/messages').then(r => r.json()).then(setMessages);

    if (socket) {
      socket.on('order:created', (order: Order) => {
        setOrders(prev => [order, ...prev]);
      });
      socket.on('order:updated', (updatedOrder: Order) => {
        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
      });
      socket.on('inventory:updated', () => {
        fetch('/api/products').then(r => r.json()).then(setProducts);
      });
      socket.on('product:updated', () => {
        fetch('/api/products').then(r => r.json()).then(setProducts);
      });
      socket.on('message:new', (msg: Message) => {
        setMessages(prev => [...prev, msg]);
      });
    }

    return () => {
      socket?.off('order:created');
      socket?.off('order:updated');
      socket?.off('inventory:updated');
      socket?.off('product:updated');
      socket?.off('message:new');
    };
  }, [socket]);

  const conversations = useMemo(() => {
    const groups: Record<string, Message[]> = {};
    messages.forEach(m => {
      if (!groups[m.phone]) groups[m.phone] = [];
      groups[m.phone].push(m);
    });
    return groups;
  }, [messages]);

  const inventoryMetrics = useMemo(() => {
    const totalUnits = products.reduce((sum, product) => sum + product.stock, 0);
    const lowStockCount = products.filter(product => product.stock <= product.reorder_level).length;
    const inventoryValue = products.reduce((sum, product) => sum + (product.cost_price * product.stock), 0);
    return {
      totalSkus: products.length,
      totalUnits,
      lowStockCount,
      inventoryValue,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = inventoryQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter(product =>
      [
        product.name,
        product.sku,
        product.category,
        product.brand,
        product.location,
        product.supplier_name,
      ].some(value => value.toLowerCase().includes(query))
    );
  }, [inventoryQuery, products]);

  const deliveryBoys = users.filter(u => u.role === 'delivery');

  const assignDelivery = async (orderId: number, deliveryBoyId: number) => {
    await fetch(`/api/orders/${orderId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delivery_boy_id: deliveryBoyId })
    });
  };

  const resetProductEditor = () => {
    setSelectedProductId(null);
    setProductImageError('');
    setProductForm(emptyProductForm());
  };

  const populateProductEditor = (product: Product) => {
    setSelectedProductId(product.id);
    setProductForm({
      name: product.name ?? '',
      sku: product.sku ?? '',
      category: product.category ?? 'General',
      brand: product.brand ?? '',
      unit: product.unit ?? 'unit',
      price: String(product.price ?? ''),
      cost_price: String(product.cost_price ?? ''),
      mrp: String(product.mrp ?? ''),
      stock: String(product.stock ?? ''),
      reorder_level: String(product.reorder_level ?? 10),
      status: product.status ?? 'Active',
      location: product.location ?? '',
      supplier_name: product.supplier_name ?? '',
      supplier_phone: product.supplier_phone ?? '',
      description: product.description ?? '',
      image_url: product.image_url ?? '',
    });
    setProductImageError('');
    setActiveTab('inventory');
  };

  const handleProductFieldChange = (field: keyof ProductFormState, value: string) => {
    setProductForm(prev => ({ ...prev, [field]: value }));
  };

  const handleProductImageUpload = async (file: File | null) => {
    if (!file) return;

    setProductImageError('');
    setIsUploadingProductImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/uploads/products/image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'Image upload failed');
      }

      setProductForm(prev => ({ ...prev, image_url: data.image_url }));
    } catch (error) {
      setProductImageError(error instanceof Error ? error.message : 'Image upload failed');
    } finally {
      setIsUploadingProductImage(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim() || !productForm.price || !productForm.stock) return;

    const payload = {
      name: productForm.name.trim(),
      sku: productForm.sku.trim(),
      category: productForm.category.trim() || 'General',
      brand: productForm.brand.trim(),
      unit: productForm.unit.trim() || 'unit',
      price: Number(productForm.price),
      cost_price: Number(productForm.cost_price || 0),
      mrp: Number(productForm.mrp || 0),
      stock: Number(productForm.stock),
      reorder_level: Number(productForm.reorder_level || 0),
      status: productForm.status,
      location: productForm.location.trim(),
      supplier_name: productForm.supplier_name.trim(),
      supplier_phone: productForm.supplier_phone.trim(),
      description: productForm.description.trim(),
      image_url: productForm.image_url.trim(),
    };

    setIsSubmittingProduct(true);
    try {
      const endpoint = selectedProductId ? `/api/products/${selectedProductId}` : '/api/products';
      const method = selectedProductId ? 'PUT' : 'POST';
      await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      resetProductEditor();
    } finally {
      setIsSubmittingProduct(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <Warehouse className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">AirO Admin</h1>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Operations Console</p>
            </div>
          </div>
          <nav className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button
              onClick={() => setActiveTab('orders')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Orders
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'inventory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Inventory
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'whatsapp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              WhatsApp Chats
            </button>
          </nav>
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
                            <span className="font-mono text-slate-500">${(item.price * item.quantity).toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-medium">
                        <span>Total</span>
                        <span>${order.items?.reduce((acc, item) => acc + (item.price * item.quantity), 0).toFixed(2) || '0.00'}</span>
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
                  No orders yet. Waiting for WhatsApp messages...
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'inventory' ? (
          <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Inventory Master</p>
                <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Catalog, pricing, supplier and stock control</h2>
                <p className="mt-2 max-w-3xl text-sm text-slate-600">
                  Maintain core catalog details, replenishment thresholds, supplier contact, shelf location and pricing controls from one page.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={resetProductEditor}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
                >
                  New Product
                </button>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                  {selectedProductId ? 'Editing existing SKU' : 'Ready to create SKU'}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Total SKUs</p>
                    <p className="mt-2 text-3xl font-bold text-slate-950">{inventoryMetrics.totalSkus}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                    <Layers3 className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Inventory Units</p>
                    <p className="mt-2 text-3xl font-bold text-slate-950">{inventoryMetrics.totalUnits}</p>
                  </div>
                  <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                    <Package className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Low Stock Items</p>
                    <p className="mt-2 text-3xl font-bold text-slate-950">{inventoryMetrics.lowStockCount}</p>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-3 text-amber-700">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">Inventory Value</p>
                    <p className="mt-2 text-3xl font-bold text-slate-950">₹{inventoryMetrics.inventoryValue.toFixed(2)}</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                    <BadgeDollarSign className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_1.45fr]">
              <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">{selectedProductId ? 'Update product master' : 'Create product master'}</h3>
                      <p className="mt-1 text-sm text-slate-500">Capture merchandising, pricing, replenishment and supplier information.</p>
                    </div>
                    {selectedProductId && (
                      <button
                        onClick={resetProductEditor}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-slate-900"
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>
                </div>

                <form onSubmit={handleSaveProduct} className="space-y-6 p-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Basic details</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Product name</span>
                        <input type="text" required value={productForm.name} onChange={e => handleProductFieldChange('name', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="Aashirvaad Atta 5kg" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">SKU</span>
                        <input type="text" value={productForm.sku} onChange={e => handleProductFieldChange('sku', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="GRC-ATT-005" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Category</span>
                        <input type="text" value={productForm.category} onChange={e => handleProductFieldChange('category', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="Staples" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Brand</span>
                        <input type="text" value={productForm.brand} onChange={e => handleProductFieldChange('brand', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="Aashirvaad" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Selling unit</span>
                        <input type="text" value={productForm.unit} onChange={e => handleProductFieldChange('unit', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="5 kg" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Lifecycle status</span>
                        <select value={productForm.status} onChange={e => handleProductFieldChange('status', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none">
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Seasonal">Seasonal</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Pricing and stock</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Selling price</span>
                        <input type="number" step="0.01" required value={productForm.price} onChange={e => handleProductFieldChange('price', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="0.00" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Cost price</span>
                        <input type="number" step="0.01" value={productForm.cost_price} onChange={e => handleProductFieldChange('cost_price', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="0.00" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">MRP</span>
                        <input type="number" step="0.01" value={productForm.mrp} onChange={e => handleProductFieldChange('mrp', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="0.00" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Current stock</span>
                        <input type="number" required value={productForm.stock} onChange={e => handleProductFieldChange('stock', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="0" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Reorder level</span>
                        <input type="number" value={productForm.reorder_level} onChange={e => handleProductFieldChange('reorder_level', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="10" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Storage location</span>
                        <input type="text" value={productForm.location} onChange={e => handleProductFieldChange('location', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="Rack C2 / Cold Zone" />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Product media</p>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
                      <div className="overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-slate-50">
                        {productForm.image_url ? (
                          <img src={productForm.image_url} alt={productForm.name || 'Product preview'} className="h-44 w-full object-cover" />
                        ) : (
                          <div className="flex h-44 flex-col items-center justify-center gap-2 text-slate-400">
                            <ImageIcon className="h-8 w-8" />
                            <span className="text-sm font-medium">No image uploaded</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <label className="block">
                          <span className="mb-1.5 block text-sm font-medium text-slate-700">Upload product image</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => {
                              void handleProductImageUpload(e.target.files?.[0] ?? null);
                              e.currentTarget.value = '';
                            }}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-slate-900 focus:outline-none"
                          />
                        </label>
                        <p className="text-sm text-slate-500">Upload a JPG, PNG or WebP product photo up to 5 MB. The current image will be used in the inventory list.</p>
                        <div className="flex flex-wrap gap-3">
                          {productForm.image_url && (
                            <button
                              type="button"
                              onClick={() => handleProductFieldChange('image_url', '')}
                              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900"
                            >
                              Remove image
                            </button>
                          )}
                          {isUploadingProductImage && <span className="text-sm font-medium text-blue-600">Uploading image...</span>}
                          {productImageError && <span className="text-sm font-medium text-rose-600">{productImageError}</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Supplier and notes</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Supplier name</span>
                        <input type="text" value={productForm.supplier_name} onChange={e => handleProductFieldChange('supplier_name', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="North Warehouse Foods" />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block text-sm font-medium text-slate-700">Supplier phone</span>
                        <input type="text" value={productForm.supplier_phone} onChange={e => handleProductFieldChange('supplier_phone', e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="+91 98xxxxxx12" />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium text-slate-700">Product notes</span>
                      <textarea value={productForm.description} onChange={e => handleProductFieldChange('description', e.target.value)} rows={4} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-slate-900 focus:outline-none" placeholder="Quality checks, storage instructions, vendor notes, pack details..." />
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-500">
                      {selectedProductId ? 'Save updates to the selected SKU.' : 'Create a new SKU with complete catalog metadata.'}
                    </div>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={resetProductEditor}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900"
                      >
                        Clear
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingProduct}
                        className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {isSubmittingProduct ? 'Saving...' : selectedProductId ? 'Update Product' : 'Save Product'}
                      </button>
                    </div>
                  </div>
                </form>
              </section>

              <section className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-slate-950">Product registry</h3>
                      <p className="mt-1 text-sm text-slate-500">Search, review stock health, inspect suppliers and reopen a SKU for editing.</p>
                    </div>
                    <label className="relative block w-full max-w-sm">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={inventoryQuery}
                        onChange={e => setInventoryQuery(e.target.value)}
                        placeholder="Search by name, SKU, category, brand..."
                        className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm focus:border-slate-900 focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        Storage control
                      </div>
                      <p className="mt-2 text-sm text-slate-500">Every SKU carries a location tag so pickers know exactly where to source it.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <ImageIcon className="h-4 w-4 text-slate-400" />
                        Product imagery
                      </div>
                      <p className="mt-2 text-sm text-slate-500">Each SKU can now carry a visual reference for faster picking and cleaner catalog review.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Users className="h-4 w-4 text-slate-400" />
                        Vendor traceability
                      </div>
                      <p className="mt-2 text-sm text-slate-500">Supplier contact fields are directly editable here for replenishment and escalation.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <ShieldCheck className="h-4 w-4 text-slate-400" />
                        Reorder discipline
                      </div>
                      <p className="mt-2 text-sm text-slate-500">Low stock and out-of-stock products are flagged against the configured reorder level.</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-white">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Product</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Pricing</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Inventory</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Operations</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {filteredProducts.map(product => (
                          <tr key={product.id} className="align-top hover:bg-slate-50/70">
                            <td className="px-6 py-5">
                              <div className="flex gap-3">
                                <div className="h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                                  {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-slate-600">
                                      <Box className="h-5 w-5" />
                                    </div>
                                  )}
                                </div>
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">{product.name}</div>
                                  <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-400">{product.sku || 'SKU pending'}</div>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{product.category}</span>
                                    {product.brand && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{product.brand}</span>}
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{product.unit}</span>
                                  </div>
                                  {product.description && (
                                    <p className="mt-3 max-w-xs text-sm text-slate-500">{product.description}</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-sm text-slate-600">
                              <div className="space-y-1.5">
                                <div className="flex justify-between gap-6"><span>Selling</span><span className="font-semibold text-slate-900">${product.price.toFixed(2)}</span></div>
                                <div className="flex justify-between gap-6"><span>Cost</span><span>${product.cost_price.toFixed(2)}</span></div>
                                <div className="flex justify-between gap-6"><span>MRP</span><span>${product.mrp.toFixed(2)}</span></div>
                                <div className="flex justify-between gap-6"><span>Margin</span><span className="font-semibold text-emerald-700">{marginPercent(product).toFixed(1)}%</span></div>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-sm text-slate-600">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between gap-6">
                                  <span>On hand</span>
                                  <span className="font-semibold text-slate-900">{product.stock}</span>
                                </div>
                                <div className="flex items-center justify-between gap-6">
                                  <span>Reorder</span>
                                  <span className="font-semibold text-slate-900">{product.reorder_level}</span>
                                </div>
                                <div className="pt-1">
                                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stockBadgeClass(product)}`}>
                                    {stockLabel(product)}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-sm text-slate-600">
                              <div className="space-y-2">
                                <div className="font-semibold text-slate-900">{product.status}</div>
                                <div className="text-slate-500">{product.location || 'Location not set'}</div>
                                <div>{product.supplier_name || 'Supplier not set'}</div>
                                {product.supplier_phone && <div className="text-slate-500">{product.supplier_phone}</div>}
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <button
                                onClick={() => populateProductEditor(product)}
                                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-900 hover:text-slate-900"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredProducts.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-500">
                              No products matched the current search.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="flex h-[600px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex w-1/3 flex-col border-r border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 p-4 font-bold text-slate-700">
                Conversations
              </div>
              <div className="flex-1 overflow-y-auto">
                {Object.keys(conversations).map(phone => {
                  const msgs = conversations[phone];
                  const lastMsg = msgs[msgs.length - 1];
                  return (
                    <div
                      key={phone}
                      onClick={() => setSelectedPhone(phone)}
                      className={`cursor-pointer border-b border-slate-100 p-4 transition-colors hover:bg-slate-50 ${selectedPhone === phone ? 'bg-slate-100' : ''}`}
                    >
                      <div className="font-bold text-slate-800">{phone}</div>
                      <div className="truncate text-sm text-slate-500">{lastMsg.content}</div>
                    </div>
                  );
                })}
                {Object.keys(conversations).length === 0 && (
                  <div className="p-8 text-center text-sm text-slate-500">No conversations yet.</div>
                )}
              </div>
            </div>
            <div className="flex flex-1 flex-col bg-slate-50/50">
              {selectedPhone ? (
                <>
                  <div className="flex items-center gap-2 border-b border-slate-200 bg-white p-4 font-bold text-slate-800">
                    <MessageSquare className="h-5 w-5 text-emerald-500" />
                    {selectedPhone}
                  </div>
                  <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    {conversations[selectedPhone]?.map(msg => (
                      <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.direction === 'outbound' ? 'rounded-tr-sm bg-emerald-500 text-white' : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800 shadow-sm'}`}>
                          <div className="text-sm">{msg.content}</div>
                          <div className={`mt-1 text-right text-[10px] ${msg.direction === 'outbound' ? 'text-emerald-100' : 'text-slate-400'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-200 bg-white p-4">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!replyText.trim()) return;
                        fetch('/api/messages/send', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ phone: selectedPhone, message: replyText })
                        });
                        setReplyText('');
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <button type="submit" className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white transition-colors hover:bg-emerald-600">
                        <Send className="h-4 w-4" />
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
                  <MessageSquare className="h-12 w-12 opacity-20" />
                  <p>Select a conversation to start messaging</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
