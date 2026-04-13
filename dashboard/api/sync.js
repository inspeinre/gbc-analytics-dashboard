import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const getCrmUrl = (endpoint) => {
    const subdomain = process.env.CRM_SUBDOMAIN;
    return `https://${subdomain}.retailcrm.ru/api/v5${endpoint}`;
};

const formatOrder = (order) => {
    if (!order) return null;
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

        // 1. Ручной импорт
        if (req.query.manual === 'true') {
            const response = await axios.get(getCrmUrl('/orders'), { params: { apiKey, limit: 100 } });
            const ordersToUpsert = response.data.orders.map(formatOrder).filter(Boolean);
            await supabase.from('orders').upsert(ordersToUpsert);
            return res.status(200).json({ message: `Импортировано ${ordersToUpsert.length} заказов` });
        }

        // 2. Обработка вебхука (Извлекаем ID из строки "order[id=172]")
        let orderId = null;
        const rawOrder = req.body?.order || req.query?.order;

        if (typeof rawOrder === 'string') {
            const match = rawOrder.match(/\d+/);
            if (match) orderId = match[0];
        } else if (rawOrder && typeof rawOrder === 'object') {
            orderId = rawOrder.id;
        }

        if (!orderId) {
            return res.status(400).json({ error: "ID заказа не найден" });
        }

        // 3. Запрос данных из API RetailCRM по ID
        const finalUrl = getCrmUrl(`/orders/${orderId}`);
        console.log("ПОЛНЫЙ ЗАПРОС В CRM:", finalUrl); // Эта строка покажет нам правду
        const response = await axios.get(finalUrl, {
            params: { apiKey }
        });

        if (!response.data.success) {
            return res.status(404).json({ error: "Заказ не найден в CRM" });
        }

        // 4. Сохранение в Supabase
        const formatted = formatOrder(response.data.order);
        const { error } = await supabase.from('orders').upsert(formatted);

        if (error) throw error;

        return res.status(200).send('OK');

    } catch (error) {
        console.error("Ошибка:", error.message);
        return res.status(500).json({ error: error.message });
    }
}