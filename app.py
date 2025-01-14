import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
app = Flask(__name__)

# Configuration
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "historical-navigator-key"
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "sqlite:///history.db")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# Get Yandex Maps API key from environment
YANDEX_MAPS_API_KEY = os.environ.get("YANDEX_MAPS_API_KEY")
if not YANDEX_MAPS_API_KEY:
    logging.error("YANDEX_MAPS_API_KEY not found in environment variables")
    raise ValueError("YANDEX_MAPS_API_KEY is required")

app.config["YANDEX_MAPS_API_KEY"] = YANDEX_MAPS_API_KEY
logging.info("Yandex Maps API key configured successfully")

# Initialize database
db.init_app(app)

with app.app_context():
    import models
    db.create_all()