import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import querystring from 'querystring';

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
    console.log("=== ВХОДЯЩИЙ ЗАПРОС ===");
    console.log("Метод:", req.method);
    console.log("Headers Content-Type:", req.headers['content-type']);

    try {
        // 1. РЕЖИМ РУЧНОГО ИМПОРТА
        if (req.query.manual === 'true') {
            const response = await axios.get(CRM_URL, { params: { apiKey: CRM_KEY, limit: 100 } });
            const ordersToUpsert = response.data.orders.map(formatOrder).filter(Boolean);
            const { error } = await supabase.from('orders').upsert(ordersToUpsert);
            if (error) throw error;
            return res.status(200).json({ message: `Импортировано ${ordersToUpsert.length} заказов` });
        }

        // 2. РАЗБОР ДАННЫХ (Самая важная часть)
        let orderData = null;

        // Сценарий А: Vercel уже распарсил тело в объект
        if (req.body && typeof req.body === 'object' && req.body.order) {
            orderData = typeof req.body.order === 'string' ? JSON.parse(req.body.order) : req.body.order;
        }
        // Сценарий Б: Тело пришло как строка (urlencode) - разбираем вручную
        else if (typeof req.body === 'string') {
            const parsed = querystring.parse(req.body);
            if (parsed.order) {
                orderData = typeof parsed.order === 'string' ? JSON.parse(parsed.order) : parsed.order;
            }
        }
        // Сценарий В: Данные прислали в строке запроса (Query)
        else if (req.query && req.query.order) {
            const rawOrder = req.query.order;
            orderData = typeof rawOrder === 'string' ? JSON.parse(rawOrder) : rawOrder;
        }

        if (!orderData) {
            console.log("Данные заказа не найдены. Body:", req.body, "Query:", req.query);
            return res.status(400).json({
                error: "Данные заказа не найдены",
                received_body: req.body
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