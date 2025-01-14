import json
import logging
from datetime import datetime
from models import MapAction, HistoricalQuery
from app import db
import os
from openai import OpenAI

# the newest OpenAI model is "gpt-4o" which was released May 13, 2024.
# do not change this unless explicitly requested by the user
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
openai = OpenAI(api_key=OPENAI_API_KEY)

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
        prompt = f"""Учитывая координаты ({latitude}, {longitude}) и временной период {time_period}, 
        предоставьте историческую информацию в формате JSON со следующей структурой на русском языке:
        {{
            "territory": "название исторической территории/государства",
            "events": ["список основных исторических событий"],
            "culture": {{
                "architecture": "описание архитектуры",
                "clothing": "описание одежды",
                "technology": "описание технологий"
            }},
            "rulers": ["список правителей этого периода"],
            "description": "общее описание периода"
        }}

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

        # Store query in database
        query = HistoricalQuery(
            latitude=latitude,
            longitude=longitude,
            time_period=time_period,
            response_data=historical_data
        )
        db.session.add(query)
        db.session.commit()

        return historical_data
    except Exception as e:
        logging.error(f"Error getting historical data: {str(e)}")
        raise