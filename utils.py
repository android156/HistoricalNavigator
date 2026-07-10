import base64
import json
import logging
from datetime import datetime
from pathlib import Path
from models import MapAction, HistoricalQuery, HistoricalPoint # Added HistoricalPoint import
from app import db
import os
from openai import DefaultHttpxClient, OpenAI
from museum_api import museum_client

# the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
# do not change this unless explicitly requested by the user
class MissingAPIKeyError(RuntimeError):
    """Raised when a feature requires an API key that is not configured."""


def get_openai_client():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise MissingAPIKeyError("OPENAI_API_KEY is required")

    proxy_url = os.environ.get("PROXY_URL")
    if proxy_url:
        logging.info("Using configured proxy for OpenAI requests")
        return OpenAI(
            api_key=api_key,
            http_client=DefaultHttpxClient(proxy=proxy_url),
        )

    return OpenAI(api_key=api_key)

def generate_historical_image(territory, time_period, historical_data):
    try:
        events_text = ', '.join(event['text'] for event in historical_data['events'])
        prompt = f"""Создайте детальное изображение исторической сцены для {territory} в период {time_period}.

        Изображение должно включать:
        - Архитектуру: {historical_data['culture']['architecture']}
        - Одежду: {historical_data['culture']['clothing']}
        - Технологии и утварь: {historical_data['culture']['technology']}
        - События: {events_text}

        Стиль: реалистичный, детализированный, исторически достоверный.
        Обязательно включите характерные элементы эпохи, людей в исторических костюмах, архитектуру и предметы быта."""

        logging.info(f"Generating image for {territory} in period {time_period}")
        response = get_openai_client().images.generate(
            model=os.environ.get("OPENAI_IMAGE_MODEL", "gpt-image-2"),
            prompt=prompt,
            size="1024x1024",
            quality=os.environ.get("OPENAI_IMAGE_QUALITY", "medium"),
            n=1
        )

        image = response.data[0]
        if image.b64_json:
            return base64.b64decode(image.b64_json)
        if image.url:
            import requests

            download = requests.get(image.url, timeout=60)
            download.raise_for_status()
            return download.content
        raise ValueError("OpenAI returned no image data")
    except Exception as e:
        logging.error(f"Error generating historical image: {str(e)}")
        return None

def log_action(action_type, action_data):
    try:
        map_action = MapAction(
            action_type=action_type,
            action_data=action_data
        )
        db.session.add(map_action)
        db.session.commit()

        logging.info(f"Action logged: {action_type} - {json.dumps(action_data)}")
    except Exception as e:
        logging.error(f"Failed to log action: {str(e)}")


def serialize_museum_artifacts(artifacts):
    return [
        artifact if isinstance(artifact, dict) else artifact.to_dict()
        for artifact in artifacts
    ]

def get_historical_data(latitude, longitude, time_period):
    try:
        logging.info(f"Getting historical data for coordinates ({latitude}, {longitude}) and period {time_period}")

        prompt = f"""Учитывая координаты ({latitude}, {longitude}) и временной период {time_period}, 
        предоставьте историческую информацию в формате JSON со следующей структурой на русском языке:
        {{
            "territory": "название исторической территории/государства",
            "events": [
                {{
                    "text": "описание события",
                    "year": "год события",
                    "wiki_url": "ссылка на википедию"
                }}
            ],
            "local_events": [
                {{
                    "text": "описание локального события",
                    "year": "год события",
                    "location": "название места",
                    "wiki_url": "ссылка на википедию"
                }}
            ],
            "culture": {{
                "architecture": "описание архитектуры",
                "clothing": "описание одежды",
                "technology": "описание технологий"
            }},
            "rulers": ["список правителей этого периода"],
            "description": "общее описание периода"
        }}

        Для local_events используйте информацию о событиях в радиусе 50км от указанных координат. Если информации нет, расширяйте радиус поиска до ближайшего исторического центра.
        Пожалуйста, предоставьте всю информацию на русском языке. Используйте исторически корректные русские названия для мест, событий и имён правителей."""

        response = get_openai_client().chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "Вы - эксперт по истории. Предоставляйте информацию на русском языке, используя исторически корректную терминологию."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )

        historical_data = json.loads(response.choices[0].message.content)
        logging.info("Successfully received historical data from OpenAI")

        try:
            # Получаем музейные артефакты
            artifacts = museum_client.search_artifacts(
                historical_data['territory'],
                time_period
            )
            historical_data['museum_artifacts'] = serialize_museum_artifacts(artifacts)
            logging.info(f"Successfully retrieved {len(artifacts)} museum artifacts")
        except Exception as e:
            logging.error(f"Error getting museum artifacts: {str(e)}")
            historical_data['museum_artifacts'] = []

        # Генерируем изображение на основе полученных данных
        image_bytes = generate_historical_image(
            historical_data['territory'],
            time_period,
            historical_data
        )

        # Сохраняем изображение локально
        if image_bytes:
            try:
                image_directory = Path('static/images/historical')
                image_directory.mkdir(parents=True, exist_ok=True)
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
                filename = f"historical_{timestamp}.png"
                (image_directory / filename).write_bytes(image_bytes)

                historical_data['image_url'] = f"/static/images/historical/{filename}"
            except Exception as e:
                logging.error(f"Error saving image locally: {str(e)}")
                historical_data['image_url'] = None

        # Сохраняем точку в базу данных
        point = HistoricalPoint(
            latitude=latitude,
            longitude=longitude,
            time_period=time_period,
            response_data=historical_data,
            image_url=historical_data.get('image_url')
        )
        db.session.add(point)
        db.session.commit()
        logging.info("Successfully stored point in database")

        return historical_data
    except MissingAPIKeyError:
        raise
    except Exception as e:
        logging.error(f"Error getting historical data: {str(e)}", exc_info=True)
        raise Exception(f"Failed to retrieve historical data: {str(e)}")