import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import {
  DollarSign, ShoppingBag, Users, Target, RefreshCw, MapPin,
  ChevronUp, ChevronDown, ChevronsUpDown, Share2, TrendingUp, Filter, X
} from 'lucide-react';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const STATUS_MAP = {
  'new': { label: 'Новый', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)' },
  'offer-replacement': { label: 'Замена', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
  'offer-analog': { label: 'Замена', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)' },
  'availability-confirmed': { label: 'В наличии', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' },
  'cancel': { label: 'Отмена', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  'complete': { label: 'Выполнен', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
  'send-to-delivery': { label: 'Доставка', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' }
};

const UTM_MAP = {
  'instagram': { label: 'Instagram', color: '#E1306C' },
  'google': { label: 'Google Ads', color: '#4285F4' },
  'tiktok': { label: 'TikTok', color: '#ffffff' },
  'facebook': { label: 'Facebook', color: '#1877F2' },
  'direct': { label: 'Прямой вход', color: '#94a3b8' },
  'referral': { label: 'Реферальный', color: '#a855f7' }
};

const App = () => {
  const [rawOrders, setRawOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCity, setFilterCity] = useState(null);
  const [filterUTM, setFilterUTM] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

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

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#020617]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Инициализация...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
          <div>
            <h1 className="text-4xl font-black text-white leading-none mb-3 tracking-tighter flex items-center gap-3">
              GBC <span className="text-blue-500">ANALYTICS</span>
            </h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
                <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Real-time Sync Active</p>
              </div>
              <p className="text-slate-600 font-bold text-[10px] uppercase">v3.0 Dark Edition</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {(filterCity !== null || filterUTM !== null || sortConfig.key !== 'created_at' || sortConfig.direction !== 'desc') && (
               <button 
                onClick={() => { setFilterCity(null); setFilterUTM(null); setSortConfig({ key: 'created_at', direction: 'desc' }); }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl hover:bg-red-500/20 font-bold text-xs transition-all"
               >
                <X size={14} /> Сбросить фильтры
              </button>
            )}
            <button onClick={fetchOrders} className="p-3 glass-card rounded-2xl hover:bg-white/10 transition-all hover:scale-110 group">
              <RefreshCw size={20} className={`text-blue-400 group-hover:text-blue-300 transition-colors ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <KpiCard title="Общая выручка" value={`${stats.revenue.toLocaleString()} ₸`} icon={<DollarSign />} color="text-emerald-400" glow="shadow-[0_0_20px_rgba(16,185,129,0.1)]" />
          <KpiCard title="Всего заказов" value={stats.count} icon={<ShoppingBag />} color="text-blue-400" glow="shadow-[0_0_20px_rgba(59,130,246,0.1)]" />
          <KpiCard title="Средний чек" value={`${stats.avg.toLocaleString()} ₸`} icon={<TrendingUp />} color="text-purple-400" glow="shadow-[0_0_20px_rgba(168,85,247,0.1)]" />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          <ChartContainer title="География продаж" icon={<MapPin className="text-blue-500" />}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cityData} onClick={(d) => d && d.activeLabel && setFilterCity(prev => prev === d.activeLabel ? null : d.activeLabel)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }} 
                  contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={34}>
                  {cityData.map((e, i) => (
                    <Cell 
                      key={i} 
                      fill={filterCity === e.name ? '#3b82f6' : '#1e293b'} 
                      className="cursor-pointer chart-transition hover:fill-blue-400"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>

          <ChartContainer title="Аналитика источников" icon={<Share2 className="text-purple-500" />}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={utmDataChart}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                  onClick={(d) => d && d.code && setFilterUTM(prev => prev === d.code ? null : d.code)}
                  className="cursor-pointer outline-none"
                >
                  {utmDataChart.map((e, i) => (
                    <Cell 
                      key={i} 
                      fill={UTM_MAP[e.code]?.color || '#475569'} 
                      stroke={filterUTM === e.code ? '#fff' : 'none'} 
                      strokeWidth={3}
                      className="chart-transition"
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '12px', color: '#fff' }} />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>
        </div>

        {/* Table Section */}
        <div className="glass-card rounded-[2.5rem] overflow-hidden border border-white/5">
          <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/5">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 flex items-center gap-2">
              <Filter size={16} className="text-blue-500" /> Последние события
            </h3>
            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full font-black uppercase">
              {processedOrders.length} записей
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-slate-400 text-[10px] uppercase font-black tracking-widest bg-white/5">
                <tr>
                  <SortableHeader label="Дата" columnKey="created_at" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Номер" columnKey="number" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Клиент" columnKey="first_name" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Город" columnKey="city" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Источник" columnKey="utm_source" currentSort={sortConfig} onSort={requestSort} />
                  <SortableHeader label="Сумма" columnKey="total_summ" currentSort={sortConfig} onSort={requestSort} />
                  <th className="px-8 py-5 text-center">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {processedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/[0.03] transition-colors group">
                    <td className="px-8 py-5 text-[11px] font-bold text-slate-400">
                      {new Date(order.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-8 py-5 text-xs font-black text-slate-200 tracking-tight">#{order.number}</td>
                    <td className="px-8 py-5">
                      <div className="text-xs text-slate-300 font-bold">{order.first_name} {order.last_name}</div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-bold text-slate-300">{order.city || '—'}</span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full" style={{ backgroundColor: UTM_MAP[order.utm_source || 'direct']?.color }}></span>
                         <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                           {UTM_MAP[order.utm_source || 'direct']?.label}
                         </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-sm font-black text-white">
                        {Number(order.total_summ).toLocaleString()} <span className="text-[10px] text-slate-400 font-bold uppercase">₸</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span 
                        className="px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all"
                        style={{ 
                          color: STATUS_MAP[order.status]?.color || '#64748b', 
                          borderColor: `${STATUS_MAP[order.status]?.color}40` || '#334155',
                          backgroundColor: STATUS_MAP[order.status]?.bg || 'transparent'
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

const KpiCard = ({ title, value, icon, color, glow }) => (
  <div className={`glass-card p-8 rounded-[2.5rem] flex items-center gap-6 transition-all duration-500 hover:scale-[1.02] hover:bg-white/[0.08] group ${glow}`}>
    <div className={`p-5 bg-white/5 ${color} rounded-2xl transition-all duration-500 group-hover:bg-white/10 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]`}>
      {React.cloneElement(icon, { size: 28 })}
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{title}</p>
      <p className="text-3xl font-black text-white tracking-tighter">{value}</p>
    </div>
  </div>
);

const ChartContainer = ({ title, icon, children }) => (
  <div className="glass-card p-8 rounded-[2.5rem] hover:bg-white/[0.04] transition-all duration-500">
    <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-10 flex items-center gap-2">
      {icon} {title}
    </h2>
    <div className="h-72">{children}</div>
  </div>
);

const SortableHeader = ({ label, columnKey, currentSort, onSort }) => {
  const isActive = currentSort.key === columnKey;
  return (
    <th className="px-8 py-5 cursor-pointer select-none transition-all hover:text-slate-300" onClick={() => onSort(columnKey)}>
      <div className="flex items-center gap-2 h-4">
        <span className={isActive ? 'text-blue-400 font-black' : ''}>{label}</span>
        {isActive ? (
          currentSort.direction === 'asc' ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-blue-500" />
        ) : (
          <ChevronsUpDown size={12} className="opacity-10" />
        )}
      </div>
    </th>
  );
};

export default App;