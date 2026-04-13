import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CRM_URL = `https://${process.env.CRM_SUBDOMAIN}.retailcrm.ru/api/v5/orders`;
const CRM_KEY = process.env.CRM_API_KEY;

const formatOrder = (order) => {
    // Если пришел не объект, а строка или null - возвращаем null
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

        if (req.body && req.body.order) {
            const rawOrder = req.body.order;
            if (typeof rawOrder === 'string') {
                try {
                    // Пытаемся распарсить строку в JSON
                    orderData = JSON.parse(rawOrder);
                } catch (e) {
                    // Если это не JSON (например, просто строка "order 169"), 
                    // мы НЕ роняем сервер, а просто фиксируем ошибку в логах
                    console.error("Данные в поле 'order' не являются JSON-объектом. Пришло:", rawOrder);
                    orderData = null;
                }
            } else {
                orderData = rawOrder;
            }
        }

        if (!orderData) {
            return res.status(400).json({
                error: "Invalid data format",
                message: "Ожидался JSON-объект заказа, но получена строка или пустое значение."
            });
        }

        const formatted = formatOrder(orderData);
        if (!formatted) {
            return res.status(400).send('Order object is invalid');
        }

        const { error } = await supabase.from('orders').upsert(formatted);
        if (error) throw error;

        return res.status(200).send('OK');

    } catch (globalError) {
        console.error("Ошибка сервера:", globalError.message);
        return res.status(500).json({ error: globalError.message });
    }
}