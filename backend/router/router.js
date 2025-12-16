import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv'
import { FootballDataOrgAPI } from '../service/currentseason.js';

dotenv.config()

export const router = express.Router();

const PREDICTION_SERVICE_URL = process.env.PREDICTION_SERVICE_URL || 'http://localhost:5001';

router.post('/api/predict', async (req, res) => {
    try {
        const { home_team, away_team, window } = req.body;
        
        if (!home_team || !away_team) {
            return res.status(400).json({ error: 'home_team and away_team are required' });
        }

        const response = await axios.post(`${PREDICTION_SERVICE_URL}/api/predict`, {
            home_team,
            away_team,
            window: window || 10
        });

        return res.json(response.data);
    } catch (error) {
        console.error('Prediction error:', error.message);
        return res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || 'Prediction service unavailable'
        });
    }
});

router.post('/api/batch-predict', async (req, res) => {
    try {
        const { matches } = req.body;
        
        if (!matches || !Array.isArray(matches)) {
            return res.status(400).json({ error: 'matches array is required' });
        }

        const response = await axios.post(`${PREDICTION_SERVICE_URL}/api/batch-predict`, {
            matches,
            window: 10
        });

        return res.json(response.data);
    } catch (error) {
        console.error('Batch prediction error:', error.message);
        return res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || 'Prediction service unavailable'
        });
    }
});

router.get('/api/teams', async (req, res) => {
    try {
        const response = await axios.get(`${PREDICTION_SERVICE_URL}/api/teams`);
        return res.json(response.data);
    } catch (error) {
        console.error('Teams fetch error:', error.message);
        return res.status(500).json({ error: 'Failed to fetch teams' });
    }
});


router.get('/api/fixtures', async (req, res) => {
    try {
        const api = new FootballDataOrgAPI(process.env.API_KEY);
        const thisWeeksMatches = await api.getMatchesForTheWeek();
        return res.json(thisWeeksMatches);
    } catch (error) {
        console.error('Fixtures fetch error:', error.message);
        return res.status(500).json({ error: 'Failed to fetch fixtures of the week.' });
    }
})

router.get('/api/team-form/:teamName', async (req, res) => {
    try {
        const { teamName } = req.params;
        const window = req.query.window || 10;
        
        const response = await axios.get(
            `${PREDICTION_SERVICE_URL}/api/team-form/${encodeURIComponent(teamName)}`,
            { params: { window } }
        );
        
        return res.json(response.data);
    } catch (error) {
        console.error('Team form error:', error.message);
        return res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || 'Failed to fetch team form'
        });
    }
});

router.get('/health', async (req, res) => {
    try {
        const predictionHealth = await axios.get(`${PREDICTION_SERVICE_URL}/health`);
        return res.json({
            backend: 'ok',
            prediction_service: predictionHealth.data
        });
    } catch (error) {
        return res.json({
            backend: 'ok',
            prediction_service: 'unavailable'
        });
    }
});