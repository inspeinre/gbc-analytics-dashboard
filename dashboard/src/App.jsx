import React, { useState, useMemo } from 'react';
import initialOrders from './data/mock_orders.json'; // Позже заменим на запрос к Supabase
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { DollarSign, ShoppingBag, Users, Target, XCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const COLORS = {
  instagram: '#E1306C', google: '#4285F4', tiktok: '#000000',
  referral: '#8b5cf6', direct: '#6b7280', organic: '#10b981'
};

const App = () => {
  // Состояния для фильтров
  const [filterCity, setFilterCity] = useState(null);
  const [filterSource, setFilterSource] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // 1. Фильтрация данных
  const filteredOrders = useMemo(() => {
    return initialOrders.filter(order => {
      const matchCity = filterCity ? order.delivery.address.city === filterCity : true;
      const matchSource = filterSource ? order.customFields.utm_source === filterSource : true;
      return matchCity && matchSource;
    });
  }, [filterCity, filterSource]);

  const sortedOrders = useMemo(() => {
    let sortableItems = [...filteredOrders];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;
        switch (sortConfig.key) {
          case 'client':
            aValue = `${a.firstName} ${a.lastName}`;
            bValue = `${b.firstName} ${b.lastName}`;
            break;
          case 'city':
            aValue = a.delivery?.address?.city || '';
            bValue = b.delivery?.address?.city || '';
            break;
          case 'sum':
            aValue = a.items.reduce((acc, item) => acc + (item.initialPrice * item.quantity), 0);
            bValue = b.items.reduce((acc, item) => acc + (item.initialPrice * item.quantity), 0);
            break;
          case 'source':
            aValue = a.customFields?.utm_source || '';
            bValue = b.customFields?.utm_source || '';
            break;
          default:
            aValue = '';
            bValue = '';
        }
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredOrders, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else {
        // Если уже было по убыванию, то при следующем клике отменяем сортировку
        setSortConfig({ key: null, direction: 'asc' });
        return;
      }
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-slate-300 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp size={14} className="text-blue-500 ml-1" />
      : <ArrowDown size={14} className="text-blue-500 ml-1" />;
  };

  // 2. Расчет KPI на основе отфильтрованных данных
  const stats = useMemo(() => {
    const revenue = filteredOrders.reduce((sum, order) =>
      sum + order.items.reduce((acc, item) => acc + (item.initialPrice * item.quantity), 0), 0
    );
    return {
      revenue,
      count: filteredOrders.length,
      average: filteredOrders.length > 0 ? Math.round(revenue / filteredOrders.length) : 0
    };
  }, [filteredOrders]);

  // 3. Данные для графиков (всегда показываем общую картину, но подсвечиваем выбор)
  const utmData = useMemo(() => {
    const raw = initialOrders.reduce((acc, order) => {
      const source = order.customFields?.utm_source || 'organic';
      acc[source] = (acc[source] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(raw).map(key => ({ name: key, value: raw[key] }));
  }, []);

  const cityData = useMemo(() => {
    const raw = initialOrders.reduce((acc, order) => {
      const city = order.delivery.address.city;
      acc[city] = (acc[city] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(raw).map(key => ({ name: key, value: raw[key] }))
      .sort((a, b) => b.value - a.value).slice(0, 10);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* Header & Reset Filters */}
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">GBC ANALYTICS</h1>
            <p className="text-slate-500">Система управления заказами</p>
          </div>
          {(filterCity || filterSource) && (
            <button
              onClick={() => { setFilterCity(null); setFilterSource(null); }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-all shadow-sm"
            >
              <XCircle size={18} /> Сбросить фильтры
            </button>
          )}
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KpiCard title="Выручка выборки" value={`${stats.revenue.toLocaleString()} ₸`} icon={<DollarSign />} color="text-emerald-600" bg="bg-emerald-50" />
          <KpiCard title="Заказов" value={stats.count} icon={<ShoppingBag />} color="text-blue-600" bg="bg-blue-50" />
          <KpiCard title="Средний чек" value={`${stats.average.toLocaleString()} ₸`} icon={<Users />} color="text-violet-600" bg="bg-violet-50" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* UTM Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Target size={20} className="text-slate-400" /> Источники (нажми для фильтра)
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={utmData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    onClick={(data) => setFilterSource(data.name)}
                    className="cursor-pointer"
                  >
                    {utmData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={COLORS[entry.name] || '#ccc'}
                        stroke={filterSource === entry.name ? '#000' : 'none'}
                        strokeWidth={3}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* City Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold mb-4">Топ городов (нажми для фильтра)</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityData} onClick={(data) => data && setFilterCity(data.activeLabel)}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {cityData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={filterCity === entry.name ? '#3b82f6' : '#cbd5e1'}
                        className="cursor-pointer"
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Таблица */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-xl font-bold">Список заказов {filterCity && `в г. ${filterCity}`}</h2>
            <span className="text-sm bg-slate-100 px-3 py-1 rounded-full text-slate-600">
              Найдено: {filteredOrders.length}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => requestSort('client')}>
                    <div className="flex items-center">Клиент {renderSortIcon('client')}</div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => requestSort('city')}>
                    <div className="flex items-center">Город {renderSortIcon('city')}</div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => requestSort('sum')}>
                    <div className="flex items-center">Сумма {renderSortIcon('sum')}</div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors group" onClick={() => requestSort('source')}>
                    <div className="flex items-center">Источник {renderSortIcon('source')}</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedOrders.map((order, i) => (
                  <tr key={i} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-700">{order.firstName} {order.lastName}</td>
                    <td className="px-6 py-4 text-slate-600">{order.delivery.address.city}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">
                      {order.items.reduce((acc, item) => acc + (item.initialPrice * item.quantity), 0).toLocaleString()} ₸
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className="px-2 py-1 rounded text-[10px] font-bold uppercase border"
                        style={{ color: COLORS[order.customFields.utm_source], borderColor: COLORS[order.customFields.utm_source] }}
                      >
                        {order.customFields.utm_source}
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
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-5">
    <div className={`p-4 ${bg} ${color} rounded-xl`}>{icon}</div>
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black text-slate-800">{value}</p>
    </div>
  </div>
);

export default App;