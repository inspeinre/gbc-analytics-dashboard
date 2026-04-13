import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Инициализация Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Вспомогательная функция для сборки URL RetailCRM
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

        // 1. РЕЖИМ РУЧНОГО ИМПОРТА (?manual=true)
        if (req.query.manual === 'true') {
            const response = await axios.get(getCrmUrl('/orders'), {
                params: { apiKey, limit: 100 }
            });

            if (!response.data.orders) throw new Error("CRM не вернула список заказов");

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
                try { orderData = JSON.parse(rawValue); } catch (e) { /* не JSON */ }
            } else {
                orderData = rawValue;
            }
        }
        // Проверяем Query
        else if (req.query && req.query.order) {
            rawValue = req.query.order;
            try {
                orderData = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
            } catch (e) { /* не JSON */ }
        }

        // 3. ЕСЛИ ПРИШЛА СТРОКА (например, "order 169"), запрашиваем данные по ID
        if (!orderData && typeof rawValue === 'string') {
            const match = rawValue.match(/\d+/);
            if (match) {
                const orderId = match[0];
                console.log(`Запрашиваем данные для ID: ${orderId}`);
                try {
                    const response = await axios.get(getCrmUrl(`/orders/${orderId}`), {
                        params: { apiKey }
                    });
                    if (response.data.success) {
                        orderData = response.data.order;
                    }
                } catch (e) {
                    console.error("Ошибка API при дозагрузке заказа:", e.message);
                }
            }
        }

        if (!orderData) {
            return res.status(400).json({ error: "Данные заказа не найдены", received: rawValue });
        }

        const formatted = formatOrder(orderData);
        const { error } = await supabase.from('orders').upsert(formatted);
        if (error) throw error;

        return res.status(200).send('OK');

    } catch (globalError) {
        console.error("Критическая ошибка сервера:", globalError.message);
        return res.status(500).json({ error: globalError.message });
    }
}