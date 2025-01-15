
from app import app, db
from models import HistoricalPoint

def check_points():
    with app.app_context():
        try:
            points = HistoricalPoint.query.all()
            total_points = len(points)
            points_with_local_images = 0
            points_without_local_images = 0
            
            print(f"\nПроверка путей к изображениям ({total_points} точек):\n")
            
            for point in points:
                if point.image_url:
                    if point.image_url.startswith('/static/images/historical/'):
                        print(f"[ЛОКАЛЬНОЕ] ID: {point.id}, Путь: {point.image_url}")
                        points_with_local_images += 1
                    else:
                        print(f"[ВНЕШНЕЕ] ID: {point.id}, Путь: {point.image_url}")
                        points_without_local_images += 1
                else:
                    print(f"[ОТСУТСТВУЕТ] ID: {point.id}, Путь: отсутствует")
                    points_without_local_images += 1
            
            print(f"\nИтого:")
            print(f"Всего точек: {total_points}")
            print(f"Точек с локальными изображениями: {points_with_local_images}")
            print(f"Точек без локальных изображений: {points_without_local_images}")

if __name__ == "__main__":
    check_points()
