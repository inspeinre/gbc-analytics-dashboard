import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CRM_URL = `https://${process.env.CRM_SUBDOMAIN}.retailcrm.ru/api/v5/orders`;
const CRM_KEY = process.env.CRM_API_KEY;

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
    // --- ЛОГИРОВАНИЕ ДЛЯ ОТЛАДКИ ---
    console.log("=== НОВЫЙ ЗАПРОС ===");
    console.log("Метод:", req.method);
    console.log("Заголовки:", JSON.stringify(req.headers));
    console.log("Тело (Body):", req.body);
    console.log("Параметры (Query):", req.query);
    // ------------------------------

    try {
        if (req.query.manual === 'true') {
            const response = await axios.get(CRM_URL, { params: { apiKey: CRM_KEY, limit: 100 } });
            const ordersToUpsert = response.data.orders.map(formatOrder).filter(Boolean);
            const { error } = await supabase.from('orders').upsert(ordersToUpsert);
            if (error) throw error;
            return res.status(200).json({ message: `Импортировано ${ordersToUpsert.length} заказов` });
        }

        let orderData = null;

        // 1. Пробуем достать из Body (если это JSON или объект)
        if (req.body && req.body.order) {
            orderData = typeof req.body.order === 'string' ? JSON.parse(req.body.order) : req.body.order;
        }
        // 2. Если Body пустое, пробуем достать из Query (строка адреса)
        else if (req.query && req.query.order) {
            try {
                orderData = typeof req.query.order === 'string' ? JSON.parse(req.query.order) : req.query.order;
            } catch (e) {
                console.error("Ошибка парсинга order из query:", e.message);
            }
        }

        if (!orderData) {
            // Вместо простой ошибки 400, возвращаем детали того, что пришло
            return res.status(400).json({
                error: 'No order data found',
                receivedBody: req.body,
                receivedQuery: req.query
            });
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