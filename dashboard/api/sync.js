import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CRM_BASE_URL = `https://${process.env.CRM_SUBDOMAIN}.retailcrm.ru/api/v5`;
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
        updated_//at: new Date()
    };
};

export default async function handler(req, res) {
    try {
        // 1. РЕЖИМ РУЧНОГО ИМПОРТА
        if (req.query.manual === 'true') {
            const response = await axios.get(`${CRM_BASE_URL}/orders`, {
                params: { apiKey: CRM_KEY, limit: 100 }
            });
            const ordersToUpsert = response.data.orders.map(formatOrder).filter(Boolean);
            const { error } = await supabase.from('orders').upsert(ordersToUpsert);
            if (error) throw error;
            return res.status(200).json({ message: `Импортировано ${ordersToUpsert.length} заказов` });
        }

        // 2. ПОЛУЧЕНИЕ ДАННЫХ ИЗ ВЕБХУКА
        let orderData = null;
        let rawValue = null;

        if (req.body && req.body.order) {
            rawValue = req.body.order;
            if (typeof rawValue === 'string') {
                try {
                    orderData = JSON.parse(rawValue);
                } catch (e) {
                    console.log("Данные не являются JSON, пробуем извлечь ID из строки:", rawValue);
                }
            } else {
                orderData = rawValue;
            }
        }

        // 3. МАГИЯ: ЕСЛИ ПРИШЛА СТРОКА "order 169", ДОСТАЕМ ДАННЫЕ ИЗ API
        if (!orderData && typeof rawValue === 'string') {
            // Регулярное выражение ищет любую последовательность цифр в строке
            const match = rawValue.match(/\d+/);
            if (match) {
                const orderId = match[0];
                console.log(`Обнаружен ID заказа ${orderId}, запрашиваем полные данные из CRM...`);
                try {
                    const response = await axios.get(`${CRM_BASE_URL}/orders/${orderId}`, {
                        params: { apiKey: CRM_KEY }
                    });
                    if (response.data.success) {
                        orderData = response.data.order;
                        console.log("Данные заказа успешно получены из API");
                    }
                } catch (e) {
                    console.error("Ошибка при запросе заказа по ID:", e.message);
                }
            }
        }

        if (!orderData) {
            return res.status(400).json({ error: "Не удалось получить данные заказа", received: rawValue });
        }

        const formatted = formatOrder(orderData);
        const { error } = await supabase.from('orders').upsert(formatted);
        if (error) throw error;

        return res.status(200).send('OK');

    } catch (globalError) {
        console.error("Критическая ошибка:", globalError.message);
        return res.status(500).json({ error: globalError.message });
    }
}