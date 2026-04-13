import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Инициализация Supabase с проверкой переменных
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("КРИТИЧЕСКАЯ ОШИБКА: Отсутствуют переменные SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CRM_URL = `https://${process.env.CRM_SUBDOMAIN}.retailcrm.ru/api/v5/orders`;
const CRM_KEY = process.env.CRM_API_KEY;

// Безопасная функция форматирования данных
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
        // 1. РЕЖИМ РУЧНОГО ИМПОРТА (?manual=true)
        if (req.query.manual === 'true') {
            if (!CRM_KEY || !process.env.CRM_SUBDOMAIN) {
                return res.status(500).json({ error: "Отсутствуют ключи CRM в переменных окружения" });
            }

            const response = await axios.get(CRM_URL, {
                params: { apiKey: CRM_KEY, limit: 100 }
            });

            if (!response.data.orders) throw new Error("CRM не вернула список заказов");

            const ordersToUpsert = response.data.orders.map(formatOrder).filter(Boolean);
            const { error } = await supabase.from('orders').upsert(ordersToUpsert);

            if (error) throw error;
            return res.status(200).json({ message: `Импортировано ${ordersToUpsert.length} заказов` });
        }

        // 2. ОБРАБОТКА ВЕБХУКА (POST)
        let orderData = null;

        if (req.body && req.body.order) {
            const rawOrder = req.body.order;
            if (typeof rawOrder === 'string') {
                try {
                    orderData = JSON.parse(rawOrder);
                } catch (e) {
                    console.error("Ошибка парсинга JSON из тела запроса:", e.message);
                }
            } else {
                orderData = rawOrder;
            }
        } else if (req.query && req.query.order) {
            try {
                const rawOrder = req.query.order;
                orderData = typeof rawOrder === 'string' ? JSON.parse(rawOrder) : rawOrder;
            } catch (e) {
                console.error("Ошибка парсинга JSON из Query:", e.message);
            }
        }

        if (!orderData) {
            console.log("Данные заказа не найдены. Тело:", req.body, "Query:", req.query);
            return res.status(400).send('No order data found');
        }

        const formatted = formatOrder(orderData);
        if (!formatted) return res.status(400).send('Invalid order format');

        const { error } = await supabase.from('orders').upsert(formatted);
        if (error) {
            console.error("Ошибка записи в Supabase:", error.message);
            return res.status(500).json({ error: "Supabase Error", details: error.message });
        }

        return res.status(200).send('OK');

    } catch (globalError) {
        console.error("Критическая ошибка сервера:", globalError.message);
        return res.status(500).json({
            error: "Internal Server Error",
            message: globalError.message
        });
    }
}