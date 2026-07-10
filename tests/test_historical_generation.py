import base64
import importlib
import sys
from pathlib import Path
from types import SimpleNamespace


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def load_utils(monkeypatch):
    for name in ["main", "utils", "museum_api", "models", "app"]:
        sys.modules.pop(name, None)
    monkeypatch.syspath_prepend(str(PROJECT_ROOT))
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    monkeypatch.setenv("FLASK_SECRET_KEY", "test-secret")
    monkeypatch.setenv("YANDEX_MAPS_API_KEY", "test-yandex-key")
    return importlib.import_module("utils")


def sample_historical_data():
    return {
        "events": [{"text": "Событие", "year": "1300", "wiki_url": ""}],
        "culture": {
            "architecture": "Белокаменная архитектура",
            "clothing": "Льняная одежда",
            "technology": "Ремесленные инструменты",
        },
    }


def test_generate_historical_image_decodes_base64_response(monkeypatch):
    utils = load_utils(monkeypatch)
    monkeypatch.setenv("OPENAI_IMAGE_MODEL", "gpt-image-2")
    monkeypatch.setenv("OPENAI_IMAGE_QUALITY", "medium")
    image_bytes = b"generated-image-bytes"
    calls = []

    class FakeImages:
        def generate(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(
                data=[SimpleNamespace(b64_json=base64.b64encode(image_bytes).decode(), url=None)]
            )

    monkeypatch.setattr(
        utils,
        "get_openai_client",
        lambda: SimpleNamespace(images=FakeImages()),
    )

    result = utils.generate_historical_image(
        "Владимиро-Суздальское княжество",
        "1300",
        sample_historical_data(),
    )

    assert result == image_bytes
    assert calls[0]["model"] == "gpt-image-2"
    assert calls[0]["quality"] == "medium"
    assert calls[0]["size"] == "1024x1024"


def test_serialize_museum_artifacts_accepts_dicts_and_models(monkeypatch):
    utils = load_utils(monkeypatch)

    class Artifact:
        def to_dict(self):
            return {"title": "Модель"}

    result = utils.serialize_museum_artifacts(
        [{"title": "Словарь"}, Artifact()]
    )

    assert result == [{"title": "Словарь"}, {"title": "Модель"}]
