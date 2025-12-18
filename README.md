# Football Fixtures Predicter

A full-stack football match prediction system with Node.js backend, Python ML prediction service, and automated data fetching.

## Architecture

```
Frontend → Node.js Backend (port 4000) → Python Prediction Service (port 5001)
                ↓
        Football Data APIs
```

## Project Structure

```
Football-Fixtures-Predicter/
├── backend/
│   ├── server.js                    # Main Express server
│   ├── router/
│   │   └── router.js                # API routes
│   ├── service/
│   │   ├── pastresults.js           # Historical data fetcher
│   │   ├── currentseason.js         # Current fixtures fetcher
│   │   └── predictionService.js     # Prediction service manager
│   ├── matches.json                 # Cached matches
│   ├── cache.json                   # Cache informations
│   └── package.json
├── prediction-service/
│   ├── prediction_api.py            # Flask API
│   ├── model_trainer.py             # Model training
│   ├── model.pkl                    # Trained model (auto-generated)
│   ├── model_training_data.json     # Model training informations
│   └── requirements.txt
└── frontend/
```
## Features

### Backend (Node.js)
-  Fetches historical match data (2023-24, 2024-25 seasons)
-  Gets current season fixtures from Football-Data.org API
-  Caches match data (refreshes daily)
-  Auto-starts Python prediction service
-  Proxies prediction requests to ML service
-  CORS enabled for frontend integration

### Prediction Service (Python ML)
- Random Forest match outcome predictor
- Auto-retrains every 2 days
-  Team form analysis (PPG, goals, goal difference)
-  Batch predictions support
-  50+ teams from top European leagues



### Prerequisites

1. **Node.js** (v14+)
2. **Python** (v3.8+)
3. **Football-Data.org API Key** (free tier)


### 2. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Prediction Service:**
```bash
cd prediction-service
pip install -r requirements.txt
```

### 3. Start the Server

```bash
cd backend
npm start
```

**This automatically:**
- Fetches/caches match data
- Starts Python prediction service on port 5001
- Starts Node.js backend on port 4000
- Trains ML model on first run

## API Endpoints

### Backend Endpoints (http://localhost:4000)

#### Get Upcoming Fixtures
```http
GET /api/fixtures
```
Returns matches scheduled for the next 7 days across all leagues.

#### Get Available Teams
```http
GET /api/teams
```
Returns list of all teams available for predictions.

#### Predict Single Match
```http
POST /api/predict
Content-Type: application/json

{
  "home_team": "Manchester City FC",
  "away_team": "Liverpool FC",
}
```

**Response:**
```json
{
  "home_team": "Manchester City FC",
  "away_team": "Liverpool FC",
  "prediction": "Home Win",
  "probabilities": {
    "home_win": 0.65,
    "draw": 0.20,
    "away_win": 0.15
  },
  "form": {
    "home_ppg": 2.3,
    "away_ppg": 2.1
  },
  "goals_stats": {
    "home_scored_avg": 2.4,
    "home_conceded_avg": 0.8,
    "home_goal_diff": 1.6,
    "away_scored_avg": 2.2,
    "away_conceded_avg": 1.0,
    "away_goal_diff": 1.2
  },
  "confidence": 0.65
}
```

#### Batch Predictions
```http
POST /api/batch-predict
Content-Type: application/json

{
  "matches": [
    {"home_team": "Team A", "away_team": "Team B"},
    {"home_team": "Team C", "away_team": "Team D"}
  ]
}
```

#### Get Team Form
```http
GET /api/team-form/:team_name
```

#### Health Check
```http
GET /health
```
Returns status of both backend and prediction service.

## Data Sources

### Historical Match Data
- **Source:** [OpenFootball](https://github.com/openfootball/football.json)
- **Coverage:** 2023-24, 2024-25 seasons
- **Leagues:** Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League

### Current Season Fixtures
- **Source:** [Football-Data.org API](https://www.football-data.org/)
- **Rate Limit:** 10 requests/minute (free tier)
- **Leagues:** Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League

## ML Model Information

- **Algorithm:** Random Forest Classifier
- **Dataset Split:** Before 2024-08-01 (training) / After 2024-08-01 (test)
- **Auto-Retrain:** Every 2 days (background task checks hourly)
- **Features:**
  - Team encoding
  - Points per game (last 10 matches)
  - Goal difference statistics
  - Home/away form
- **Output Classes:**
  - 0 = Away Win
  - 1 = Home Win
  - 2 = Draw

## Caching

### Match Data Cache
- **File:** `backend/matches.json`
- **Metadata:** `backend/cache.json`
- **Refresh:** Once per day
- **Purpose:** Reduce API calls to external services

### Model Cache
- **File:** `prediction-service/model.pkl`
- **Metadata:** `prediction-service/model_metadata.json`
- **Refresh:** Every 2 days automatically
- **Purpose:** Avoid retraining on every startup


## Troubleshooting

### Backend won't start
- Check if port 4000 is available
- Verify `.env` file exists with valid API_KEY
- Run `npm install` to ensure dependencies are installed

### Prediction service fails
- Python service starts automatically with backend
- Check Python is installed and in PATH
- Verify `requirements.txt` packages installed
- First run takes ~30 seconds to train model

### "Team not found" errors
- Team names must match exactly (e.g., "Manchester City FC" not "Man City")
- Teams only available if they have historical match data
- Use `GET /api/teams` to see available team names

### API rate limit errors
- Free tier limited to 10 requests/minute
- Backend caches data to minimize API calls
- Data refreshes daily

### Model accuracy
- Current accuracy: ~50% - expected for football prediction (high variance sport)
- Use probabilities for better insights

## Project Scripts

```bash
# Backend - starts the prediction service as well
cd backend
npm start          # Start server
npm run dev        # Start server in dev mode
