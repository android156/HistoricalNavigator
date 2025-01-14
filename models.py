from app import db
from datetime import datetime

class MapAction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    action_type = db.Column(db.String(50), nullable=False)
    action_data = db.Column(db.JSON)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class HistoricalQuery(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    time_period = db.Column(db.String(100), nullable=False)
    response_data = db.Column(db.JSON)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class MuseumArtifact(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    museum_id = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    period = db.Column(db.String(100))
    location = db.Column(db.String(200))
    image_url = db.Column(db.String(500))
    source_museum = db.Column(db.String(200), nullable=False)
    extra_data = db.Column(db.JSON)  # Переименовали metadata в extra_data
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'title': self.title,
            'description': self.description,
            'period': self.period,
            'location': self.location,
            'image_url': self.image_url,
            'source_museum': self.source_museum
        }