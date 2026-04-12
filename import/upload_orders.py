import json
import retailcrm

# Данные для доступа к API
URL = 'https://alex3d33.retailcrm.ru'
API_KEY = 'EkdpVTqXDkjxYAx2mmGU3vdIuJjdAtH2'

def main():
    # Инициализация клиента
    # Используем версию v5 как указано в документации
    crm_client = retailcrm.v5(URL, API_KEY)
    
    # Чтение данных заказов из JSON
    json_filename = 'mock_orders.json'
    try:
        with open(json_filename, 'r', encoding='utf-8') as file:
            orders = json.load(file)
            # Если в файле один заказ (словарь), обернем его в список
            if isinstance(orders, dict):
                orders = [orders]
                
            # Берем только 1 первый заказ для новой проверки
            # orders = orders[:1]
    except FileNotFoundError:
        print(f"Ошибка: Файл {json_filename} не найден.")
        return
    except json.JSONDecodeError:
        print(f"Ошибка: Некорректный формат JSON в файле {json_filename}.")
        return

    print(f"Найдено заказов для загрузки: {len(orders)}")

    # Отправка заказов в RetailCRM
    for index, order_data in enumerate(orders):
        print(f"\nОтправка заказа {index + 1}...")
        
        # Комментируем удаление по просьбе пользователя
        # order_data.pop('orderType', None)
        # order_data.pop('orderMethod', None)
        
        # client.order_create отправляет POST запрос на /api/v5/orders/create
        response = crm_client.order_create(order_data)
        
        if response.is_successful():
            order_id = response.get_response().get('id')
            print(f"Заказ успешно создан! ID в RetailCRM: {order_id}")
        else:
            print(f"Ошибка создания заказа.")
            print(f"Сообщение: {response.get_error_msg()}")
            if response.get_errors():
                print(f"Детали: {response.get_errors()}")

if __name__ == '__main__':
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    main()
