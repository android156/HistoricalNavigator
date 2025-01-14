from app import app
from datetime import datetime
from flask import render_template, jsonify, request
from utils import get_historical_data, log_action
import logging
from models import MapAction, HistoricalQuery, HistoricalPoint # Added import for HistoricalPoint


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/historical-data', methods=['POST'])
def get_history():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Отсутствуют данные запроса'}), 400
            
        lat = data.get('latitude')
        lng = data.get('longitude')
        time_period = data.get('timePeriod')

        # Validate input data
        if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)):
            return jsonify({'error': 'Некорректные координаты'}), 400

        if not time_period:
            time_period = str(datetime.now().year)

        logging.info(f"Processing request for coordinates ({lat}, {lng}) and period {time_period}")
        
        log_action('historical_data_request', {
            'latitude': lat,
            'longitude': lng,
            'time_period': time_period
        })

        historical_info = get_historical_data(lat, lng, time_period)
        if not historical_info:
            return jsonify({'error': 'Данные не найдены'}), 404
            
        return jsonify(historical_info)
    except ValueError as ve:
        logging.error(f"Validation error: {str(ve)}")
        return jsonify({'error': str(ve)}), 400
    except Exception as e:
        error_msg = str(e)
        logging.error(f"Error processing historical data request: {error_msg}", exc_info=True)
        return jsonify({
            'error': 'Не удалось получить исторические данные',
            'details': error_msg
        }), 500

@app.route('/api/log', methods=['POST'])
def log_map_action():
    try:
        data = request.get_json()
        action_type = data.get('type')
        action_data = data.get('data')

        if not action_type:
            return jsonify({'error': 'Тип действия обязателен'}), 400

        log_action(action_type, action_data)
        return jsonify({'status': 'success'})
    except Exception as e:
        logging.error(f"Error logging action: {str(e)}", exc_info=True)
        return jsonify({'error': 'Не удалось записать действие'}), 500

@app.route('/api/historical-points', methods=['GET'])
def get_historical_points():
    try:
        points = HistoricalPoint.query.all()
        return jsonify([{
            'latitude': p.latitude,
            'longitude': p.longitude,
            'time_period': p.time_period,
            'response_data': p.response_data,
            'image_url': p.image_url
        } for p in points])
    except Exception as e:
        logging.error(f"Error retrieving historical points: {str(e)}", exc_info=True)
        return jsonify({'error': 'Не удалось получить исторические точки'}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=True)