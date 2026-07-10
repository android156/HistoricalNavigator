import importlib
import logging
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def clear_project_modules():
    for name in ["main", "utils", "museum_api", "models", "app"]:
        sys.modules.pop(name, None)


def prepare_import(monkeypatch):
    clear_project_modules()
    monkeypatch.syspath_prepend(str(PROJECT_ROOT))
    monkeypatch.delenv("YANDEX_MAPS_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setenv("DATABASE_URL", "sqlite:///:memory:")
    monkeypatch.setenv("FLASK_SECRET_KEY", "test-secret")


def test_app_imports_without_api_keys_for_local_development(monkeypatch):
    prepare_import(monkeypatch)

    app_module = importlib.import_module("app")

    assert app_module.app.config["YANDEX_MAPS_API_KEY"] == ""


def test_http_client_debug_logging_is_disabled_by_default(monkeypatch):
    prepare_import(monkeypatch)
    monkeypatch.delenv("LOG_LEVEL", raising=False)

    importlib.import_module("app")

    assert logging.getLogger("httpx").level == logging.WARNING
    assert logging.getLogger("httpcore").level == logging.WARNING


def test_homepage_renders_without_yandex_api_key(monkeypatch):
    prepare_import(monkeypatch)
    main_module = importlib.import_module("main")

    response = main_module.app.test_client().get("/")

    assert response.status_code == 200
    assert "Исторический навигатор" in response.get_data(as_text=True)


def test_historical_endpoint_returns_503_without_openai_key(monkeypatch):
    prepare_import(monkeypatch)
    main_module = importlib.import_module("main")

    response = main_module.app.test_client().post(
        "/api/historical-data",
        json={"latitude": 55.7558, "longitude": 37.6173, "timePeriod": "1200"},
    )

    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.get_json()["error"]


def test_openai_client_uses_proxy_url_when_configured(monkeypatch):
    prepare_import(monkeypatch)
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    monkeypatch.setenv("PROXY_URL", "http://user:password@proxy.example:8080")
    utils_module = importlib.import_module("utils")

    proxy_calls = []
    openai_calls = []
    proxy_client = object()

    def fake_http_client(**kwargs):
        proxy_calls.append(kwargs)
        return proxy_client

    def fake_openai(**kwargs):
        openai_calls.append(kwargs)
        return object()

    monkeypatch.setattr(utils_module, "DefaultHttpxClient", fake_http_client, raising=False)
    monkeypatch.setattr(utils_module, "OpenAI", fake_openai)

    utils_module.get_openai_client()

    assert proxy_calls == [{"proxy": "http://user:password@proxy.example:8080"}]
    assert openai_calls == [
        {"api_key": "test-openai-key", "http_client": proxy_client}
    ]
