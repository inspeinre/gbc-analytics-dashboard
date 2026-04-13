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
            const response = await axios.get(getCrmUrl('/orders'), {
                params: { apiKey, limit: 100 }
            });
            const ordersToUpsert = response.data.orders.map(formatOrder).filter(Boolean);
            const { error } = await supabase.from('orders').upsert(ordersToUpsert);
            if (error) throw error;
            return res.status(200).json({ message: `Успешно импортировано ${ordersToUpsert.length} заказов` });
        }

        // 2. ОБРАБОТКА ВЕБХУКА
        let orderData = null;

        if (req.body && req.body.order) {
            const rawOrder = req.body.order;
            if (typeof rawOrder === 'string') {
                try {
                    // Пытаемся распарсить JSON
                    orderData = JSON.parse(rawOrder);
                } catch (e) {
                    // Если не JSON, оставляем строку для дальнейшего поиска ID
                    orderData = null;
                }
            } else {
                orderData = rawOrder;
            }
        }

        // Если в Body нет готового объекта, ищем ID в строке (в Body или Query)
        if (!orderData) {
            const rawString = typeof req.body === 'string' ? req.body : (req.body?.order || req.query?.order || '');
            const match = String(rawString).match(/\d+/);

            if (match) {
                const orderId = match[0];
                console.log(`Поиск данных по ID: ${orderId}`);
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
            return res.status(400).json({ error: "Заказ не найден в запросе и в API" });
        }

        const formatted = formatOrder(orderData);
        const { error } = await supabase.from('orders').upsert(formatted);
        if (error) throw error;

        return res.status(200).send('OK');

    } catch (globalError) {
        console.error("Ошибка сервера:", globalError.message);
        return res.status(500).json({ error: globalError.message });
    }
}