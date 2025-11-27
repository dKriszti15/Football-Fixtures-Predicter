# Match Prediction Service

A Flask-based REST API for predicting football match outcomes using machine learning.

## Project Structure

### Required Files
```
prediction-service/
├── prediction_api.py      # Main Flask API application
├── model_trainer.py       # Model training and feature engineering
├── matches.json           # Historical match data (4,339 matches)
├── requirements.txt       # Python dependencies
└── README.md              # This file
```

### Generated Files (created automatically)
- `model.pkl` - Trained model (created on first run)
- `__pycache__/` - Python cache files

## Features

- ✅ Predict match outcomes (Home Win, Draw, Away Win)
- ✅ Get probability distributions for each outcome based on team form and statistics
- ✅ Batch predictions for multiple matches

## Quick Start

### 1. Install Dependencies

```bash
pip install flask flask-cors pandas scikit-learn requests
```

### 2. Start the Service

**Windows:**
```bash
python prediction_api.py
```

**The service will start on http://localhost:5001**

## API Endpoints

### Health Check
```bash
GET /health
```

Returns service status and available teams count.

### Get Available Teams
```bash
GET /api/teams
```

Returns list of all teams available for predictions.

### Predict Match Outcome
```bash
POST /api/predict
Content-Type: application/json

{
  "home_team": "Manchester United FC",
  "away_team": "Liverpool FC",
  "window": 10
}
```

Returns prediction with probabilities and team form statistics.

### Get Team Form
```bash
GET /api/team-form/<team_name>?window=10
```

Returns current form statistics for a specific team.

### Batch Predictions
```bash
POST /api/batch-predict
Content-Type: application/json

{
  "matches": [
    {"home_team": "Team A", "away_team": "Team B"},
    {"home_team": "Team C", "away_team": "Team D"}
  ],
  "window": 10
}
```

## Example Usage

### Using Python requests:

```python
import requests

response = requests.post(
    "http://localhost:5001/api/predict",
    json={
        "home_team": "Arsenal FC",
        "away_team": "Chelsea FC"
    }
)

result = response.json()
print(f"Prediction: {result['prediction']}")
print(f"Home Win: {result['probabilities']['home_win']:.1%}")
print(f"Draw: {result['probabilities']['draw']:.1%}")
print(f"Away Win: {result['probabilities']['away_win']:.1%}")
```

## Model Information

- **Algorithm:** Random Forest Classifier
- **Training Data:** 4,339 historical matches (since 2023-08-11)
- **Test Accuracy:** ~50%
- **Features Used:**
  - Team codes
  - Points per game (PPG) over last 10 matches
  - Goal difference statistics
  - Home/away advantage

## Files

- `prediction_api.py` - Main Flask API application
- `model_trainer.py` - Model training and feature engineering
- `matches.json` - Historical match data
- `model.pkl` - Saved trained model (created on first run)

## Notes

- The model is automatically trained on first run (takes ~30 seconds)
- Subsequent starts load the pre-trained model from `model.pkl`
- To retrain with updated data, use `POST /api/retrain` endpoint


## Troubleshooting

**Service won't start:**
- Ensure port 5001 is not already in use
- Check that all dependencies are installed
- Verify `matches.json` exists and is valid

**Model accuracy:**
- ~50%
- Consider using probabilities rather than just the prediction
