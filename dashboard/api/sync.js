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

        // 1. РУЧНОЙ ИМПОРТ (без изменений)
        if (req.query.manual === 'true') {
            const response = await axios.get(getCrmUrl('/orders'), { params: { apiKey, limit: 100 } });
            const ordersToUpsert = response.data.orders.map(formatOrder).filter(Boolean);
            const { error } = await supabase.from('orders').upsert(ordersToUpsert);
            if (error) throw error;
            return res.status(200).json({ message: `Импортировано ${ordersToUpsert.length} заказов` });
        }

        // 2. ОБРАБОТКА ВЕБХУКА (Спец. разбор для формата order[id=172])
        let orderId = null;

        if (req.body && req.body.order) {
            const rawOrder = req.body.order;

            if (typeof rawOrder === 'string') {
                // Ищем цифры внутри строки (например, из "order[id=172]" вытащим "172")
                const match = rawOrder.match(/\d+/);
                if (match) {
                    orderId = match[0];
                }
            } else if (typeof rawOrder === 'object' && rawOrder.id) {
                // Если вдруг пришел объект, просто берем его id
                orderId = rawOrder.id;
            }
        }

        if (!orderId) {
            console.log("ID заказа не найден в запросе. Body:", req.body);
            return res.status(400).json({ error: "ID заказа не найден в поле 'order'" });
        }

        // 3. ЗАПРОС ПОЛНЫХ ДАННЫХ ИЗ API CRM
        console.log(`Запрос полных данных для заказа ID: ${orderId}`);
        const response = await axios.get(getCrmUrl(`/orders/${orderId}`), {
            params: { apiKey, by: 'id' }
        });

        if (!response.data.success) {
            throw new Error("CRM вернула ошибку при запросе заказа");
        }

        const orderData = response.data.order;
        const formatted = formatOrder(orderData);

        if (!formatted) throw new Error("Не удалось отформатировать данные заказа");

        // 4. СОХРАНЕНИЕ В SUPABASE
        const { error } = await supabase.from('orders').upsert(formatted);
        if (error) throw error;

        return res.status(200).send('OK');

    } catch (globalError) {
        console.error("Ошибка сервера:", globalError.message);
        return res.status(500).json({ error: globalError.message });
    }
}