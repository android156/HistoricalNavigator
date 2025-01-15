
from app import app, db
from models import HistoricalPoint
import logging

def clean_points():
    with app.app_context():
        try:
            # Получаем точки без изображений или с невалидными URL
            invalid_points = HistoricalPoint.query.filter(
                (HistoricalPoint.image_url == None) |
                (HistoricalPoint.image_url == '') |
                (HistoricalPoint.image_url == 'Historical Image') |
                (HistoricalPoint.image_url.like('%undefined%'))
            ).all()
            
            count = len(invalid_points)
            
            # Удаляем найденные точки
            for point in invalid_points:
                db.session.delete(point)
            
            db.session.commit()
            print(f"Удалено {count} точек без изображений")
            
        except Exception as e:
            print(f"Ошибка при очистке базы данных: {e}")
            db.session.rollback()

if __name__ == "__main__":
    clean_points()
