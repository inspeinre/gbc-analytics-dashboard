import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// Инициализация Supabase с использованием Service Role Key (для прав записи)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CRM_URL = `https://${process.env.CRM_SUBDOMAIN}.retailcrm.ru/api/v5/orders`;
const CRM_KEY = process.env.CRM_API_KEY;

// Функция для превращения данных из CRM в формат вашей таблицы Supabase
const formatOrder = (order) => {
    return {
        id: order.id,
        number: order.number,
        created_at: order.createdAt,
        status: order.status,                // Код статуса (например, offer-replacement)
        order_type: order.orderType,         // Код типа заказа
        total_summ: order.totalSumm,
        first_name: order.firstName || null,
        last_name: order.lastName || null,
        city: order.delivery?.address?.city || null,
        utm_source: order.customFields?.utm_source || null,
        offer_replacement: order.customFields?.offer_replacement || null,
        raw_data: order,                     // Сохраняем весь оригинал заказа
        updated_at: new Date()
    };
};

export default async function handler(req, res) {
    // --- РЕЖИМ 1: РУЧНОЙ ИМПОРТ (через браузер: /api/sync?manual=true) ---
    if (req.query.manual === 'true') {
        try {
            const response = await axios.get(CRM_URL, {
                params: { apiKey: CRM_KEY, limit: 100 }
            });

            const ordersToUpsert = response.data.orders.map(formatOrder);

            const { error } = await supabase.from('orders').upsert(ordersToUpsert, { onConflict: 'id' });

            if (error) throw error;
            return res.status(200).json({ message: `Успешно импортировано ${ordersToUpsert.length} заказов` });
        } catch (err) {
            return res.status(500).json({ error: err.message });
        }
    }

    // --- РЕЖИМ 2: ВЕБХУК (когда CRM сама присылает данные) ---
    // RetailCRM шлет данные в ключе 'order'. Мы проверяем его наличие.
    let orderData = null;
    if (req.body && req.body.order) {
        // Вебхук может прийти как строка JSON или как объект
        orderData = typeof req.body.order === 'string' ? JSON.parse(req.body.order) : req.body.order;
    }

    if (orderData) {
        try {
            const formatted = formatOrder(orderData);
            const { error } = await supabase.from('orders').upsert(formatted, { onConflict: 'id' });

            if (error) throw error;
            return res.status(200).send('OK');
        } catch (err) {
            console.error('Ошибка записи в Supabase:', err.message);
            return res.status(500).send('Database Error');
        }
    }

    return res.status(400).send('No valid order data found');
}