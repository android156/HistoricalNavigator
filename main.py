from app import app
from flask import render_template, jsonify, request
from utils import get_historical_data, log_action
import logging

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/historical-data', methods=['POST'])
def get_history():
    try:
        data = request.get_json()
        lat = data.get('latitude')
        lng = data.get('longitude')
        time_period = data.get('timePeriod')

        if not all([lat, lng, time_period]):
            return jsonify({'error': 'Необходимо указать координаты и временной период'}), 400

        log_action('historical_data_request', {
            'latitude': lat,
            'longitude': lng,
            'time_period': time_period
        })

        historical_info = get_historical_data(lat, lng, time_period)
        return jsonify(historical_info)
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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)