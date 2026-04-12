import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { DollarSign, ShoppingBag, Users, AlertCircle, RefreshCw } from 'lucide-react';
import { format, parseISO, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';

// Инициализация Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Справочник статусов (коды из RetailCRM -> названия)
const STATUS_MAP = {
  'new': { label: 'Новый', color: '#3b82f6' },
  'offer-replacement': { label: 'Предложить замену', color: '#f59e0b' }, // Ваш важный статус
  'availability-confirmed': { label: 'В наличии', color: '#10b981' },
  'cancel': { label: 'Отмена', color: '#ef4444' },
  'complete': { label: 'Выполнен', color: '#6366f1' }
};

const ORDER_TYPES = {
  'eshop-individual': 'Физ. лицо',
  'eshop-legal': 'Юр. лицо'
};

const App = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Загрузка данных
  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error) setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // 1. Расчет KPI
  const stats = useMemo(() => {
    const revenue = orders.reduce((sum, o) => sum + Number(o.total_summ), 0);
    const replacements = orders.filter(o => o.status === 'offer-replacement').length;
    return {
      revenue,
      count: orders.length,
      avgCheck: orders.length ? Math.round(revenue / orders.length) : 0,
      replacements
    };
  }, [orders]);

  // 2. Данные для графика динамики (по дням)
  const chartData = useMemo(() => {
    const groups = orders.reduce((acc, o) => {
      const date = format(parseISO(o.created_at), 'dd MMM', { locale: ru });
      acc[date] = (acc[date] || 0) + Number(o.total_summ);
      return acc;
    }, {});
    return Object.keys(groups).map(date => ({ date, amount: groups[date] })).reverse();
  }, [orders]);

  // 3. Распределение по статусам
  const statusData = useMemo(() => {
    const groups = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(groups).map(key => ({
      name: STATUS_MAP[key]?.label || key,
      value: groups[key],
      color: STATUS_MAP[key]?.color || '#94a3b8'
    }));
  }, [orders]);

  if (loading) return <div className="flex h-screen items-center justify-center">Загрузка данных...</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Nova Dashboard</h1>
            <p className="text-slate-500 text-sm font-medium">Live данные из Supabase + RetailCRM</p>
          </div>
          <button
            onClick={fetchOrders}
            className="p-2 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <KpiCard title="Выручка" value={`${stats.revenue.toLocaleString()} ₸`} icon={<DollarSign />} color="text-emerald-600" bg="bg-emerald-50" />
          <KpiCard title="Заказы" value={stats.count} icon={<ShoppingBag />} color="text-blue-600" bg="bg-blue-50" />
          <KpiCard title="Средний чек" value={`${stats.avgCheck.toLocaleString()} ₸`} icon={<Users />} color="text-violet-600" bg="bg-violet-50" />
          <KpiCard title="Нужна замена" value={stats.replacements} icon={<AlertCircle />} color="text-amber-600" bg="bg-amber-50" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Динамика выручки */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold mb-6">Динамика выручки</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Статусы */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold mb-6">Статусы заказов</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value">
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Таблица */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h2 className="text-lg font-bold">Последние заказы</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
                <tr>
                  <th className="px-6 py-4">ID / Номер</th>
                  <th className="px-6 py-4">Клиент / Город</th>
                  <th className="px-6 py-4">Тип</th>
                  <th className="px-6 py-4">Сумма</th>
                  <th className="px-6 py-4">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-700">#{order.number}</div>
                      <div className="text-[10px] text-slate-400">ID: {order.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-700">{order.first_name} {order.last_name}</div>
                      <div className="text-xs text-slate-400">{order.city || '—'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        {ORDER_TYPES[order.order_type] || order.order_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {Number(order.total_summ).toLocaleString()} ₸
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm"
                        style={{
                          backgroundColor: `${STATUS_MAP[order.status]?.color}20`,
                          color: STATUS_MAP[order.status]?.color
                        }}
                      >
                        {STATUS_MAP[order.status]?.label || order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ title, value, icon, color, bg }) => (
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-5">
    <div className={`p-4 ${bg} ${color} rounded-2xl shadow-inner`}>{icon}</div>
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-xl font-black text-slate-800 tracking-tight">{value}</p>
    </div>
  </div>
);

export default App;