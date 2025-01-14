import json
import logging
from datetime import datetime
from models import MapAction, HistoricalQuery
from app import db
import os
from openai import OpenAI
from museum_api import museum_client

# the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
# do not change this unless explicitly requested by the user
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    logging.error("OPENAI_API_KEY not found in environment variables")
    raise ValueError("OPENAI_API_KEY is required")

openai = OpenAI(api_key=OPENAI_API_KEY)

def generate_historical_image(territory, time_period, historical_data):
    try:
        prompt = f"""Создайте детальное изображение исторической сцены для {territory} в период {time_period}.

        Изображение должно включать:
        - Архитектуру: {historical_data['culture']['architecture']}
        - Одежду: {historical_data['culture']['clothing']}
        - Технологии и утварь: {historical_data['culture']['technology']}
        - События: {', '.join(historical_data['events'])}

        Стиль: реалистичный, детализированный, исторически достоверный.
        Обязательно включите характерные элементы эпохи, людей в исторических костюмах, архитектуру и предметы быта."""

        logging.info(f"Generating image for {territory} in period {time_period}")
        response = openai.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1024x1024",
            quality="hd",
            n=1
        )

        return response.data[0].url
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

        response = openai.chat.completions.create(
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
            historical_data['museum_artifacts'] = [artifact.to_dict() for artifact in artifacts]
            logging.info(f"Successfully retrieved {len(artifacts)} museum artifacts")
        except Exception as e:
            logging.error(f"Error getting museum artifacts: {str(e)}")
            historical_data['museum_artifacts'] = []

        # Генерируем изображение на основе полученных данных
        image_url = generate_historical_image(
            historical_data['territory'], 
            time_period,
            historical_data
        )

        # Добавляем URL изображения к данным
        historical_data['image_url'] = image_url

        # Store query in database
        query = HistoricalQuery(
            latitude=latitude,
            longitude=longitude,
            time_period=time_period,
            response_data=historical_data
        )
        db.session.add(query)
        db.session.commit()
        logging.info("Successfully stored query in database")

        return historical_data
    except Exception as e:
        logging.error(f"Error getting historical data: {str(e)}", exc_info=True)
        raise Exception(f"Failed to retrieve historical data: {str(e)}")