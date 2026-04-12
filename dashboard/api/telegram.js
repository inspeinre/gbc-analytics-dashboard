export default async function handler(req, res) {
    // Прокси-сервер принимает данные из тела запроса (POST) или из строки (GET)
    const method = req.method;
    const data = method === 'POST' ? req.body : req.query;

    const { chat_id, text, parse_mode = 'html' } = data;

    if (!chat_id || !text) {
        return res.status(400).json({ error: 'Missing chat_id or text' });
    }

    const botToken = '8599215185:AAHeSK_T6sO9k6hhZHVQT4B1xed_jjoDklk';
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chat_id,
                text: text,
                parse_mode: parse_mode
            })
        });

        const result = await response.json();
        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}