import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const getCrmUrl = (endpoint) => {
    const subdomain = process.env.CRM_SUBDOMAIN;
    if (!subdomain) throw new Error("Переменная CRM_SUBDOMAIN не задана в Vercel");
    return `https://${subdomain}.retailcrm.ru/api/v5${endpoint}`;
};

const formatOrder = (order) => {
    if (!order || typeof order !== 'object') return null;
    return {
        id: order.id,
        number: order.number || 'Без номера',
        created_at: order.createdAt || new Date().toISOString(),
        status: order.status || 'unknown',
        order_type: order.orderType || 'unknown',
        total_summ: order.totalSumm || 0,
        first_name: order.firstName || null,
        last_name: order.lastName || null,
        city: order.delivery?.address?.city || 'Не указан',
        utm_source: order.customFields?.utm_source || 'direct',
        raw_data: order,
        updated_at: new Date()
    };
};

export default async function handler(req, res) {
    try {
        const apiKey = process.env.CRM_API_KEY;
        if (!apiKey) throw new Error("Переменная CRM_API_KEY не задана в Vercel");

        // 1. РЕЖИМ РУЧНОГО ИМПОРТА
        if (req.query.manual === 'true') {
            const response = await axios.get(getCrmUrl('/orders'), { params: { apiKey, limit: 100 } });
            const ordersToUpsert = response.data.orders.map(formatOrder).filter(Boolean);
            const { error } = await supabase.from('orders').upsert(ordersToUpsert);
            if (error) throw error;
            return res.status(200).json({ message: `Успешно импортировано ${ordersToUpsert.length} заказов` });
        }

        // 2. ОБРАБОТКА ВЕБХУКА
        let orderData = null;
        let rawValue = null;

        // Проверяем Body
        if (req.body && req.body.order) {
            rawValue = req.body.order;
            if (typeof rawValue === 'string') {
                try {
                    orderData = JSON.parse(rawValue);
                } catch (e) {
                    // Если не JSON, оставляем строку для извлечения ID ниже
                }
            } else {
                orderData = rawValue;
            }
        }
        // Проверяем Query
        else if (req.query && req.query.order) {
            rawValue = req.query.order;
            try {
                orderData = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
            } catch (e) { }
        }

        // 3. ИЗВЛЕЧЕНИЕ ID И ЗАПРОС В API (если пришла строка типа "order[id=173]")
        if (!orderData && typeof rawValue === 'string') {
            const match = rawValue.match(/\d+/);
            if (match) {
                const orderId = match[0];
                const response = await axios.get(getCrmUrl(`/orders/${orderId}`), {
                    params: { apiKey }
                });
                if (response.data.success) {
                    orderData = response.data.order;
                }
            }
        }

        if (!orderData) {
            return res.status(400).json({ error: "Заказ не найден" });
        }

        const formatted = formatOrder(orderData);
        const { error } = await supabase.from('orders').upsert(formatted);
        if (error) throw error;

        return res.status(200).send('OK');

    } catch (globalError) {
        console.error("Ошибка:", globalError.message);
        return res.status(500).json({ error: globalError.message });
    }
}