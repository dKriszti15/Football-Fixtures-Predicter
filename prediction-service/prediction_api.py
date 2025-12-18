from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import pickle
import os
import json
import threading
import time
from datetime import datetime, timedelta
from model_trainer import (
    load_match_data,
    calculate_ppg,
    calculate_goals_stats,
    engineer_features,
    create_team_encoding,
    split_train_test,
    train_model,
    main as train_main
)

app = Flask(__name__)
CORS(app)

model = None
df = None
team_to_code = None
predictors = [
    'home_team_code',
    'away_team_code',
    'home_ppg',
    'away_ppg',
    'home_goal_diff',
    'away_goal_diff'
]


RETRAIN_INTERVAL_DAYS = 2
TRAIN_DATA_FILE = 'model_training_data.json'

def should_retrain_model():
    """Check if model needs retraining"""
    if not os.path.exists(TRAIN_DATA_FILE):
        return True
    
    try:
        with open(TRAIN_DATA_FILE, 'r') as f:
            metadata = json.load(f)
            last_trained = datetime.fromisoformat(metadata['last_trained'])
            days_since_training = (datetime.now() - last_trained).days
            
            return days_since_training >= RETRAIN_INTERVAL_DAYS
    except Exception as e:
        print(f"Error reading metadata: {e}")
        return True

def train_and_save_model():
    """Train model and save info"""
    global model, df, team_to_code
    
    print("Training new model...")
    model, df, team_to_code = train_main()
    
    with open('model.pkl', 'wb') as f:
        pickle.dump({
            'model': model,
            'df': df,
            'team_to_code': team_to_code
        }, f)
    
    with open(TRAIN_DATA_FILE, 'w') as f:
        json.dump({
            'last_trained': datetime.now().isoformat(),
            'total_teams': len(team_to_code),
            'total_matches': len(df),
            'next_retrain': (datetime.now() + timedelta(days=RETRAIN_INTERVAL_DAYS)).isoformat()
        }, f, indent=2)
    
    print(f"Model trained and saved. Next retrain in {RETRAIN_INTERVAL_DAYS} days.")

def load_model():
    """Load model / train"""
    global model, df, team_to_code

    if os.path.exists('model.pkl') and not should_retrain_model():
        print("Loading saved model...")
        with open('model.pkl', 'rb') as f:
            data = pickle.load(f)
            model = data['model']
            df = data['df']
            team_to_code = data['team_to_code']
        print(f"Model loaded. {len(team_to_code)} teams available.")
    else:
        if os.path.exists('model.pkl'):
            print(f"Model is older than {RETRAIN_INTERVAL_DAYS} days. Retraining...")
        else:
            print("No saved model found. Training new model...")
        train_and_save_model()

def check_and_retrain():
    """Background task to check if retraining is needed"""
    while True:
        time.sleep(3600)
        
        if should_retrain_model():
            print("Automatic retraining triggered...")
            try:
                train_and_save_model()
            except Exception as e:
                print(f"Error during automatic retraining: {e}")


def predict_fixture(home_team, away_team, window=10):
    """
        Args:
            home_team: Name of home team
            away_team: Name of away team

        Returns:
            Dictionary with prediction, probabilities, and form stats
    """
    prediction_date = pd.Timestamp.now()

    if home_team not in team_to_code:
        raise ValueError(f"Team '{home_team}' not found in training data")
    if away_team not in team_to_code:
        raise ValueError(f"Team '{away_team}' not found in training data")

    home_ppg = calculate_ppg(df, home_team, prediction_date, window)
    away_ppg = calculate_ppg(df, away_team, prediction_date, window)

    home_gs, home_gc, home_gd = calculate_goals_stats(df, home_team, prediction_date, window)
    away_gs, away_gc, away_gd = calculate_goals_stats(df, away_team, prediction_date, window)

    home_code = team_to_code[home_team]
    away_code = team_to_code[away_team]

    fixture = pd.DataFrame([{
        'home_team_code': home_code,
        'away_team_code': away_code,
        'home_ppg': home_ppg,
        'away_ppg': away_ppg,
        'home_goal_diff': home_gd - away_gs,
        'away_goal_diff': away_gd - home_gs
    }])

    prediction = model.predict(fixture)[0]
    probabilities = model.predict_proba(fixture)[0]

    outcome_map = {0: 'Away Win', 1: 'Home Win', 2: 'Draw'}

    return {
        'home_team': home_team,
        'away_team': away_team,
        'prediction': outcome_map[prediction],
        'probabilities': {
            'home_win': float(probabilities[1]),
            'draw': float(probabilities[2]),
            'away_win': float(probabilities[0])
        },
        'form': {
            'home_ppg': float(home_ppg),
            'away_ppg': float(away_ppg)
        },
        'goals_stats': {
            'home_scored_avg': float(home_gs),
            'home_conceded_avg': float(home_gc),
            'home_goal_diff': float(home_gd),
            'away_scored_avg': float(away_gs),
            'away_conceded_avg': float(away_gc),
            'away_goal_diff': float(away_gd)
        },
        'confidence': float(max(probabilities)),
        'timestamp': datetime.now().isoformat()
    }


@app.route('/health', methods=['GET'])
def health():

    return jsonify({
        'status': 'ok',
        'service': 'Match Prediction Service',
        'timestamp': datetime.now().isoformat(),
        'teams_available': len(team_to_code) if team_to_code else 0,
        'model_loaded': model is not None
    })


@app.route('/api/teams', methods=['GET'])
def get_teams():
    try:
        teams = sorted(team_to_code.keys())
        return jsonify({
            'teams': teams,
            'count': len(teams)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/predict', methods=['POST'])
def predict():
    """
        Request body:
        {
            "home_team": "Team Name",
            "away_team": "Team Name"
        }
    """
    try:
        data = request.json

        if not data:
            return jsonify({'error': 'Request body required'}), 400

        home_team = data.get('home_team')
        away_team = data.get('away_team')
        window = data.get('window', 10)

        if not home_team or not away_team:
            return jsonify({
                'error': 'Both home_team and away_team are required'
            }), 400

        if not isinstance(window, int) or window < 1 or window > 50:
            return jsonify({
                'error': 'Window must be an integer between 1 and 50'
            }), 400

        result = predict_fixture(home_team, away_team, window)

        return jsonify(result)

    except ValueError as e:
        # team not found
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        print(f"Prediction error: {str(e)}")
        return jsonify({'error': f'Prediction failed: {str(e)}'}), 500


@app.route('/api/batch-predict', methods=['POST'])
def batch_predict():
    """
        Request body:
        {
            "matches": [
                {"home_team": "Team A", "away_team": "Team B"},
                {"home_team": "Team C", "away_team": "Team D"}
            ],
            "window": 10  // optional
        }
    """
    try:
        data = request.json
        matches = data.get('matches', [])
        window = data.get('window', 10)

        if not matches:
            return jsonify({'error': 'matches array required'}), 400

        if len(matches) > 50:
            return jsonify({'error': 'Maximum 50 matches per request'}), 400

        results = []
        errors = []

        for idx, match in enumerate(matches):
            try:
                home_team = match.get('home_team')
                away_team = match.get('away_team')

                if not home_team or not away_team:
                    errors.append({
                        'index': idx,
                        'error': 'Missing team names'
                    })
                    continue

                result = predict_fixture(home_team, away_team, window)
                results.append(result)

            except Exception as e:
                errors.append({
                    'index': idx,
                    'home_team': match.get('home_team'),
                    'away_team': match.get('away_team'),
                    'error': str(e)
                })

        return jsonify({
            'predictions': results,
            'errors': errors,
            'total_requested': len(matches),
            'successful': len(results),
            'failed': len(errors)
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/retrain', methods=['POST'])
def retrain():
    """Manually trigger model retraining"""
    try:
        print("Manual retraining triggered...")
        train_and_save_model()
        return jsonify({
            'status': 'success',
            'message': 'Model retrained successfully',
            'teams_count': len(team_to_code),
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/team-form/<team_name>', methods=['GET'])
def get_team_form(team_name):

    try:
        if team_name not in team_to_code:
            return jsonify({'error': f'Team "{team_name}" not found'}), 404

        window = int(request.args.get('window', 10))
        prediction_date = pd.Timestamp.now()

        ppg = calculate_ppg(df, team_name, prediction_date, window)
        goals_scored, goals_conceded, goal_diff = calculate_goals_stats(
            df, team_name, prediction_date, window
        )

        recent_matches = df[
            ((df['home_team'] == team_name) | (df['away_team'] == team_name)) &
            (df['date'] < prediction_date)
            ].tail(window)

        matches_played = len(recent_matches)

        return jsonify({
            'team': team_name,
            'form': {
                'ppg': float(ppg),
                'goals_scored_avg': float(goals_scored),
                'goals_conceded_avg': float(goals_conceded),
                'goal_difference': float(goal_diff),
                'matches_played': matches_played,
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500



load_model()

# Start background retraining checker
retraining_thread = threading.Thread(target=check_and_retrain, daemon=True)
retraining_thread.start()
print(f"Background retraining checker started. Model will retrain every {RETRAIN_INTERVAL_DAYS} days.")

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'

    app.run(
        host='0.0.0.0',
        port=port,
        debug=debug
    )