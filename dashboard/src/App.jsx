import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  DollarSign, ShoppingBag, Users, Target, XCircle, RefreshCw, MapPin,
  ChevronUp, ChevronDown, ChevronsUpDown
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const STATUS_MAP = {
  'new': { label: 'Новый', color: '#3b82f6' },
  'offer-replacement': { label: 'Предложить замену', color: '#f59e0b' },
  'availability-confirmed': { label: 'В наличии', color: '#10b981' },
  'cancel': { label: 'Отмена', color: '#ef4444' },
  'complete': { label: 'Выполнен', color: '#6366f1' },
  'send-to-delivery': { label: 'Доставка', color: '#8b5cf6' }
};

const App = () => {
  const [rawOrders, setRawOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Фильтры
  const [filterCity, setFilterCity] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);

  // СОСТОЯНИЕ СОРТИРОВКИ
  // { key: 'total_summ', direction: 'asc' | 'desc' | null }
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setRawOrders(data);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  // 1. ЛОГИКА СОРТИРОВКИ (Цикличная: asc -> desc -> null)
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') direction = 'desc';
      else if (sortConfig.direction === 'desc') direction = null;
    }
    setSortConfig({ key: direction ? key : null, direction });
  };

  // 2. ФИЛЬТРАЦИЯ И СОРТИРОВКА ДАННЫХ
  const processedOrders = useMemo(() => {
    // Сначала фильтруем
    let items = rawOrders.filter(order => {
      const matchCity = filterCity ? order.city === filterCity : true;
      const matchStatus = filterStatus ? order.status === filterStatus : true;
      return matchCity && matchStatus;
    });

    // Затем сортируем, если выбрано направление
    if (sortConfig.key !== null && sortConfig.direction !== null) {
      items.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];

        // Обработка специальных случаев (числа, null)
        if (sortConfig.key === 'total_summ') {
          aValue = Number(aValue);
          bValue = Number(bValue);
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [rawOrders, filterCity, filterStatus, sortConfig]);

  // Данные для графиков
  const cityData = useMemo(() => {
    const counts = rawOrders.reduce((acc, o) => { acc[o.city || 'Не указан'] = (acc[o.city || 'Не указан'] || 0) + 1; return acc; }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [rawOrders]);

  const statusChartData = useMemo(() => {
    const counts = rawOrders.reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
    return Object.entries(counts).map(([code, value]) => ({ code, name: STATUS_MAP[code]?.label || code, value }));
  }, [rawOrders]);

  const stats = useMemo(() => {
    const revenue = processedOrders.reduce((sum, o) => sum + Number(o.total_summ), 0);
    return { revenue, count: processedOrders.length, avg: processedOrders.length ? Math.round(revenue / processedOrders.length) : 0 };
  }, [processedOrders]);

  // Компонент иконки сортировки
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ChevronsUpDown size={14} className="text-slate-300 group-hover:text-slate-400" />;
    if (sortConfig.direction === 'asc') return <ChevronUp size={14} className="text-blue-500" />;
    if (sortConfig.direction === 'desc') return <ChevronDown size={14} className="text-blue-500" />;
    return <ChevronsUpDown size={14} className="text-slate-300" />;
  };

  if (loading) return <div className="flex h-screen items-center justify-center font-medium text-slate-400 italic">Синхронизация...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 text-slate-900 font-sans tracking-tight">
      <div className="max-w-7xl mx-auto">

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 text-sm">
          <div>
            <h1 className="text-4xl font-black text-slate-900 leading-none mb-1">NOVA PRO</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">E-commerce Intelligence System</p>
          </div>
          <div className="flex gap-2">
            {(filterCity || filterStatus || sortConfig.key) && (
              <button onClick={() => { setFilterCity(null); setFilterStatus(null); setSortConfig({ key: null, direction: null }); }} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 font-bold shadow-sm transition-all text-xs">
                <XCircle size={14} /> СБРОСИТЬ ВСЁ
              </button>
            )}
            <button onClick={fetchOrders} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-sm"><RefreshCw size={20} className="text-slate-400" /></button>
          </div>
        </header>

        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KpiCard title="Выручка" value={`${stats.revenue.toLocaleString()} ₸`} icon={<DollarSign />} color="text-emerald-500" bg="bg-emerald-50" />
          <KpiCard title="Заказы" value={stats.count} icon={<ShoppingBag />} color="text-blue-500" bg="bg-blue-50" />
          <KpiCard title="Средний чек" value={`${stats.avg.toLocaleString()} ₸`} icon={<Users />} color="text-violet-500" bg="bg-violet-50" />
        </div>

        {/* Графики */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <MapPin size={16} /> География продаж
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityData} onClick={(d) => d && setFilterCity(d.activeLabel)}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#cbd5e1', fontWeight: 700 }} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" radius={[4, 4, 4, 4]} barSize={24}>
                    {cityData.map((e, i) => <Cell key={i} fill={filterCity === e.name ? '#3b82f6' : '#f1f5f9'} className="cursor-pointer hover:fill-blue-400 transition-all" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <Target size={16} /> Аналитика статусов
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusChartData} innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value" onClick={(d) => setFilterStatus(d.code)} className="cursor-pointer outline-none">
                    {statusChartData.map((e, i) => <Cell key={i} fill={STATUS_MAP[e.code]?.color || '#f1f5f9'} stroke={filterStatus === e.code ? '#000' : 'none'} strokeWidth={2} />)}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ТАБЛИЦА С СОРТИРОВКОЙ */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/50 text-slate-400 text-[9px] uppercase font-black tracking-[0.2em]">
                <tr>
                  <SortableHeader label="Дата" columnKey="created_at" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Номер" columnKey="number" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Клиент" columnKey="first_name" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Город" columnKey="city" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Сумма" columnKey="total_summ" currentSort={sortConfig} onSort={requestSort} />
                  <th className="px-8 py-5 text-center">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {processedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/50 transition-colors group cursor-default">
                    <td className="px-8 py-5 text-[11px] font-bold text-slate-400">
                      {new Date(order.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-8 py-5 text-xs font-black text-slate-900">#{order.number}</td>
                    <td className="px-8 py-5">
                      <div className="text-xs font-bold text-slate-700">{order.first_name} {order.last_name}</div>
                      <div className="text-[10px] text-slate-400 uppercase font-bold">{order.utm_source || 'direct'}</div>
                    </td>
                    <td className="px-8 py-5 text-xs text-slate-500 font-bold">{order.city || '—'}</td>
                    <td className="px-8 py-5 font-black text-slate-900 text-sm">
                      {Number(order.total_summ).toLocaleString()} <span className="text-[10px] text-slate-400">₸</span>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider shadow-sm border border-transparent"
                        style={{ backgroundColor: `${STATUS_MAP[order.status]?.color || '#f1f5f9'}15`, color: STATUS_MAP[order.status]?.color || '#94a3b8' }}>
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

// ВСПОМОГАТЕЛЬНЫЙ КОМПОНЕНТ ЗАГОЛОВКА
const SortableHeader = ({ label, columnKey, currentSort, onSort }) => {
  const isActive = currentSort.key === columnKey;

  return (
    <th
      className={`px-8 py-5 cursor-pointer group transition-colors hover:text-slate-900 ${isActive ? 'bg-blue-50/30 text-blue-600' : ''}`}
      onClick={() => onSort(columnKey)}
    >
      <div className="flex items-center gap-2">
        {label}
        <div className="flex flex-col">
          {isActive && currentSort.direction === 'asc' && <ChevronUp size={12} />}
          {isActive && currentSort.direction === 'desc' && <ChevronDown size={12} />}
          {!isActive && <ChevronsUpDown size={12} className="opacity-20 group-hover:opacity-100" />}
        </div>
      </div>
    </th>
  );
};

const KpiCard = ({ title, value, icon, color, bg }) => (
  <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex items-center gap-6 hover:shadow-md transition-all duration-300">
    <div className={`p-5 ${bg} ${color} rounded-2xl shadow-inner`}>{icon}</div>
    <div>
      <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-1">{title}</p>
      <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
    </div>
  </div>
);

export default App;