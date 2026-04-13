import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  DollarSign, ShoppingBag, Users, Target, RefreshCw, MapPin,
  ChevronUp, ChevronDown, ChevronsUpDown, Share2
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const STATUS_MAP = {
  'new': { label: 'Новый', color: '#64748b' },
  'offer-replacement': { label: 'Замена', color: '#f59e0b' },
  'offer-analog': { label: 'Замена', color: '#f59e0b' },
  'availability-confirmed': { label: 'В наличии', color: '#10b981' },
  'cancel': { label: 'Отмена', color: '#ef4444' },
  'complete': { label: 'Выполнен', color: '#6366f1' },
  'send-to-delivery': { label: 'Доставка', color: '#8b5cf6' }
};

const ORDER_TYPES = {
  'eshop-individual': 'Физ. лицо',
  'eshop-legal': 'Юр. лицо'
};

const UTM_MAP = {
  'instagram': { label: 'Instagram', color: '#E1306C' },
  'google': { label: 'Google Ads', color: '#4285F4' },
  'tiktok': { label: 'TikTok', color: '#000000' },
  'facebook': { label: 'Facebook', color: '#1877F2' },
  'direct': { label: 'Прямой вход', color: '#64748b' },
  'referral': { label: 'Реферальный', color: '#8b5cf6' }
};

const App = () => {
  const [rawOrders, setRawOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCity, setFilterCity] = useState(null);
  const [filterUTM, setFilterUTM] = useState(null);
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

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') direction = 'desc';
      else if (sortConfig.direction === 'desc') direction = null;
    }
    setSortConfig({ key: direction ? key : null, direction });
  };

  // ЛОГИКА ФИЛЬТРАЦИИ
  const processedOrders = useMemo(() => {
    let items = rawOrders.filter(order => {
      const matchCity = filterCity ? order.city === filterCity : true;
      const matchUTM = filterUTM ? (order.utm_source || 'direct') === filterUTM : true;
      return matchCity && matchUTM;
    });

    if (sortConfig.key !== null && sortConfig.direction !== null) {
      items.sort((a, b) => {
        let aValue = a[sortConfig.key] || '';
        let bValue = b[sortConfig.key] || '';
        if (sortConfig.key === 'total_summ') { aValue = Number(aValue); bValue = Number(bValue); }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return items;
  }, [rawOrders, filterCity, filterUTM, sortConfig]);

  const cityData = useMemo(() => {
    const counts = rawOrders.reduce((acc, o) => { acc[o.city || 'Не указан'] = (acc[o.city || 'Не указан'] || 0) + 1; return acc; }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [rawOrders]);

  const utmDataChart = useMemo(() => {
    const counts = rawOrders.reduce((acc, o) => {
      const src = o.utm_source || 'direct';
      acc[src] = (acc[src] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([code, value]) => ({
      code,
      name: UTM_MAP[code]?.label || code,
      value
    }));
  }, [rawOrders]);

  const stats = useMemo(() => {
    const revenue = processedOrders.reduce((sum, o) => sum + Number(o.total_summ), 0);
    return { revenue, count: processedOrders.length, avg: processedOrders.length ? Math.round(revenue / processedOrders.length) : 0 };
  }, [processedOrders]);

  if (loading) return <div className="flex h-screen items-center justify-center font-bold text-slate-400">Загрузка...</div>;

  return (
    <div className="min-h-screen bg-[#f1f5f9] p-4 md:p-8 text-slate-700 font-sans tracking-tight">
      <div className="max-w-7xl mx-auto">

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black text-slate-900 leading-none mb-2 tracking-tighter">NOVA ANALYTICS</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Live System Active</p>
            </div>
          </div>
          <button onClick={fetchOrders} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 shadow-sm transition-all hover:scale-105 group">
            <RefreshCw size={20} className={`text-slate-400 group-hover:text-blue-500 transition-colors ${loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {/* KPI Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <KpiCard title="Общая выручка" value={`${stats.revenue.toLocaleString()} ₸`} icon={<DollarSign />} color="text-emerald-600" bg="bg-emerald-50" />
          <KpiCard title="Кол-во заказов" value={stats.count} icon={<ShoppingBag />} color="text-blue-600" bg="bg-blue-50" />
          <KpiCard title="Средний чек" value={`${stats.avg.toLocaleString()} ₸`} icon={<Users />} color="text-indigo-600" bg="bg-indigo-50" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Города - Более выразительный дизайн */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
              <MapPin size={16} className="text-blue-500" /> География продаж
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityData} onClick={(d) => {
                  if (d && d.activeLabel) setFilterCity(prev => prev === d.activeLabel ? null : d.activeLabel);
                }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={32}>
                    {cityData.map((e, i) => (
                      <Cell
                        key={i}
                        fill={filterCity === e.name ? '#1e293b' : '#e2e8f0'}
                        className="cursor-pointer chart-transition hover:fill-slate-400"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Источники - Более выразительный дизайн */}
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
              <Share2 size={16} className="text-indigo-500" /> Аналитика источников
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={utmDataChart}
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={6}
                    dataKey="value"
                    onClick={(d) => {
                      if (d && d.code) setFilterUTM(prev => prev === d.code ? null : d.code);
                    }}
                    className="cursor-pointer outline-none"
                  >
                    {utmDataChart.map((e, i) => (
                      <Cell
                        key={i}
                        fill={UTM_MAP[e.code]?.color || '#cbd5e1'}
                        stroke={filterUTM === e.code ? '#fff' : 'none'}
                        strokeWidth={3}
                        className="chart-transition"
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 600 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ТАБЛИЦА */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden transition-all">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-400 text-[9px] uppercase font-black tracking-widest border-b border-slate-100">
                <tr>
                  <SortableHeader label="Дата" columnKey="created_at" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Номер" columnKey="number" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Клиент" columnKey="first_name" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Город" columnKey="city" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Сумма" columnKey="total_summ" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Источник" columnKey="utm_source" currentSort={sortConfig} onSort={requestSort} />
                  <th className="px-6 py-4 text-center">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {processedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 text-[11px] font-medium text-slate-400">
                      {new Date(order.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-slate-700">#{order.number}</td>
                    <td className="px-6 py-4 text-xs text-slate-600 font-semibold">{order.first_name} {order.last_name}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-700">{order.city || '—'}</td>
                    <td className="px-6 py-4 font-black text-slate-800 text-xs">
                      {Number(order.total_summ).toLocaleString()} <span className="text-[10px] text-slate-400 uppercase">₸</span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="text-[9px] font-bold px-2 py-1 rounded border transition-all"
                        style={{ color: UTM_MAP[order.utm_source || 'direct']?.color, borderColor: `${UTM_MAP[order.utm_source || 'direct']?.color}40`, backgroundColor: `${UTM_MAP[order.utm_source || 'direct']?.color}10` }}
                      >
                        {UTM_MAP[order.utm_source || 'direct']?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border border-slate-100 bg-white shadow-sm transition-all"
                        style={{ color: STATUS_MAP[order.status]?.color || '#94a3b8' }}>
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

const SortableHeader = ({ label, columnKey, currentSort, onSort }) => {
  const isActive = currentSort.key === columnKey;
  return (
    <th
      className="px-6 py-4 cursor-pointer select-none transition-all hover:text-slate-700"
      onClick={() => onSort(columnKey)}
    >
      <div className="flex items-center gap-1.5 h-4">
        <span className={isActive ? 'text-slate-800 font-bold' : ''}>{label}</span>
        <div className="w-4 flex justify-center">
          {isActive && currentSort.direction === 'asc' && <ChevronUp size={14} strokeWidth={3} className="text-emerald-500" />}
          {isActive && currentSort.direction === 'desc' && <ChevronDown size={14} strokeWidth={3} className="text-emerald-500" />}
          {!isActive && <ChevronsUpDown size={12} className="opacity-20 text-slate-400" />}
        </div>
      </div>
    </th>
  );
};

const KpiCard = ({ title, value, icon, color, bg }) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-200 flex items-center gap-5 shadow-sm hover:shadow-md transition-all duration-300 group">
    <div className={`p-4 ${bg} ${color} rounded-2xl transition-transform group-hover:scale-110`}>{icon}</div>
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-2xl font-bold text-slate-800 tracking-tight">{value}</p>
    </div>
  </div>
);

export default App;