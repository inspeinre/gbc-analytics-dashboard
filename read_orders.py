import json
import retailcrm
import sys

URL = 'https://alex3d33.retailcrm.ru'
API_KEY = 'EkdpVTqXDkjxYAx2mmGU3vdIuJjdAtH2'

def main():
    crm_client = retailcrm.v5(URL, API_KEY)
    
    # Считываем переданные ID
    order_ids = sys.argv[1:] if len(sys.argv) > 1 else ['55', '56']
    
    orders_data = []
    
    for oid in order_ids:
        r = crm_client.order(oid, 'id')
        if r.is_successful():
            orders_data.append(r.get_response().get('order', {}))
    
    print(f"Прочитано заказов из RetailCRM: {len(orders_data)}\n")
    
    for o in orders_data:
        print(f"--- Заказ #{o.get('id')} ---")
        print(f"Клиент: {o.get('firstName')} {o.get('lastName')}")
        print(f"Телефон: {o.get('phone')} | Email: {o.get('email')}")
        print(f"Тип заказа: {o.get('orderType')} | Метод: {o.get('orderMethod')} | Статус: {o.get('status')}")
        print(f"Пользовательские поля (customFields): {o.get('customFields', {})}")
        
        if 'delivery' in o and 'address' in o['delivery']:
            addr = o['delivery']['address']
            print(f"Адрес: {addr.get('city', '')}, {addr.get('text', '')}")
        
        items = o.get('items', [])
        print(f"Товары ({len(items)}):")
        for item in items:
            # Извлекаем displayName из объекта offer
            p_name = item.get('offer', {}).get('displayName', item.get('productName', 'Неизвестный товар'))
            print(f"  - {p_name} ({item.get('quantity')} шт. по {item.get('initialPrice')} руб.)")
        print()

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
