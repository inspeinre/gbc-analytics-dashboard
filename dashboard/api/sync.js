import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import querystring from 'querystring'; // Добавили библиотеку для ручного разбора

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
    try {
        // 1. РЕЖИМ РУЧНОГО ИМПОРТА
        if (req.query.manual === 'true') {
            const response = await axios.get(CRM_URL, { params: { apiKey: CRM_KEY, limit: 100 } });
            const ordersToUpsert = response.data.orders.map(formatOrder).filter(Boolean);
            const { error } = await supabase.from('orders').upsert(ordersToUpsert);
            if (error) throw error;
            return res.status(200).json({ message: `Импортировано ${ordersToUpsert.length} заказов` });
        }

        // 2. ОБРАБОТКА ВЕБХУКА
        let orderData = null;

        // Пытаемся достать данные из Body разными способами
        if (req.body) {
            if (typeof req.body === 'string') {
                // Если пришел сырой текст (urlencoded), разбираем его вручную
                const parsedBody = querystring.parse(req.body);
                if (parsedBody.order) {
                    try {
                        orderData = JSON.parse(parsedBody.order);
                    } catch (e) {
                        orderData = parsedBody.order;
                    }
                }
            } else if (req.body.order) {
                // Если Vercel уже распарсил тело в объект
                orderData = typeof req.body.order === 'string' ? JSON.parse(req.body.order) : req.body.order;
            }
        }

        // Если в Body ничего нет, проверяем Query (строку адреса)
        if (!orderData && req.query.order) {
            try {
                orderData = typeof req.query.order === 'string' ? JSON.parse(req.query.order) : req.query.order;
            } catch (e) { }
        }

        if (!orderData) {
            console.log("Данные не найдены. Body:", req.body);
            return res.status(400).send('No order data found');
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