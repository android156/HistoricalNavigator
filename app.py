import os
import logging
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase

# Configure application logging without exposing HTTP headers/cookies from SDKs.
log_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
log_level = getattr(logging, log_level_name, logging.INFO)
logging.basicConfig(level=log_level)
for noisy_logger in ("httpx", "httpcore", "openai"):
    logging.getLogger(noisy_logger).setLevel(logging.WARNING)
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

# Get Yandex Maps API key from environment. The app must still import and render
# locally without the key; the browser-side map will show Yandex's own key error
# until YANDEX_MAPS_API_KEY is configured.
YANDEX_MAPS_API_KEY = os.environ.get("YANDEX_MAPS_API_KEY", "")
if not YANDEX_MAPS_API_KEY:
    logging.warning("YANDEX_MAPS_API_KEY not found; map API will be unavailable")
else:
    logging.info("Yandex Maps API key configured successfully")

app.config["YANDEX_MAPS_API_KEY"] = YANDEX_MAPS_API_KEY

# Initialize database
db.init_app(app)

with app.app_context():
    import models
    db.create_all()