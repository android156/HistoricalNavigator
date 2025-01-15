
import os
from app import app, db
from models import HistoricalPoint
import requests
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)

def download_image(url, save_path):
    try:
        response = requests.get(url)
        response.raise_for_status()
        
        with open(save_path, 'wb') as f:
            f.write(response.content)
        return True
    except Exception as e:
        logging.error(f"Error downloading image from {url}: {str(e)}")
        return False

def migrate_images():
    with app.app_context():
        # Ensure directory exists
        if not os.path.exists('static/images/historical'):
            os.makedirs('static/images/historical', exist_ok=True)

        points = HistoricalPoint.query.all()
        migrated_count = 0
        failed_count = 0

        for point in points:
            if not point.image_url or point.image_url.startswith('/static/images/historical/'):
                continue

            if point.image_url.startswith(('http://', 'https://')):
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"historical_{timestamp}.jpg"
                filepath = os.path.join('static/images/historical', filename)
                
                if download_image(point.image_url, filepath):
                    old_url = point.image_url
                    point.image_url = f"/static/images/historical/{filename}"
                    db.session.commit()
                    logging.info(f"Migrated image: {old_url} -> {point.image_url}")
                    migrated_count += 1
                else:
                    failed_count += 1

        logging.info(f"Migration completed. Migrated: {migrated_count}, Failed: {failed_count}")

if __name__ == "__main__":
    migrate_images()
