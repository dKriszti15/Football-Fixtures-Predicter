import dotenv from 'dotenv'
import express from 'express';
import { getPastResults } from './service/pastresults.js';
import fs from 'fs';
import axios from 'axios';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { FootballDataOrgAPI } from './service/currentseason.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config()

const hostname = process.env.SERVER_HOST || '127.0.0.1';
const port = process.env.SERVER_PORT || 3000;
const PREDICTION_SERVICE_URL = process.env.PREDICTION_SERVICE_URL || 'http://localhost:5001';

let predictionServiceProcess = null;

function startPredictionService() {
    const predictionServicePath = path.join(__dirname, '..', 'prediction-service');
    const pythonScript = path.join(predictionServicePath, 'prediction_api.py');
    
    console.log('Starting prediction service...');
    
    predictionServiceProcess = spawn('python', [pythonScript], {
        cwd: predictionServicePath,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    
    predictionServiceProcess.stdout.on('data', (data) => {
        console.log(`[Prediction Service] ${data.toString().trim()}`);
    });
    
    predictionServiceProcess.stderr.on('data', (data) => {
        console.error(`[Prediction Service Error] ${data.toString().trim()}`);
    });
    
    predictionServiceProcess.on('close', (code) => {
        console.log(`Prediction service exited with code ${code}`);
        predictionServiceProcess = null;
    });
    
    predictionServiceProcess.on('error', (err) => {
        console.error('Failed to start prediction service:', err);
        predictionServiceProcess = null;
    });
}

async function waitForPredictionService(maxAttempts = 30, interval = 1000) {
    for (let i = 0; i < maxAttempts; i++) {
        try {

            const allData = await getPastResults();

            fs.writeFile('matches.json', JSON.stringify(allData, null, 2), 'utf8', (err) => {
                if (err) {
                    console.error('Error writing to matches.json:', err);
                }
            });


            await axios.get(`${PREDICTION_SERVICE_URL}/health`, { timeout: 500 });
            console.log('Prediction service is ready!');
            return true;
        } catch (error) {
            if (i === 0) {
                console.log('Waiting for prediction service to start...');
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    console.warn('Prediction service did not start within expected time');
    return false;
}

process.on('SIGINT', () => {
    console.log('\nShutting down...');
    if (predictionServiceProcess) {
        predictionServiceProcess.kill();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    if (predictionServiceProcess) {
        predictionServiceProcess.kill();
    }
    process.exit(0);
});

const app = express();

app.use(express.json());

app.get('/', async (req, res) => {
    const allData = await getPastResults();

    fs.writeFile('matches.json', JSON.stringify(allData, null, 2), 'utf8', (err) => {
        if (err) {
            console.error('Error writing to matches.json:', err);
        }
    });
    
    return res.json(allData);
});

app.post('/api/predict', async (req, res) => {
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

app.post('/api/batch-predict', async (req, res) => {
    try {
        const { matches, window } = req.body;
        
        if (!matches || !Array.isArray(matches)) {
            return res.status(400).json({ error: 'matches array is required' });
        }

        const response = await axios.post(`${PREDICTION_SERVICE_URL}/api/batch-predict`, {
            matches,
            window: window || 10
        });

        return res.json(response.data);
    } catch (error) {
        console.error('Batch prediction error:', error.message);
        return res.status(error.response?.status || 500).json({
            error: error.response?.data?.error || 'Prediction service unavailable'
        });
    }
});

app.get('/api/teams', async (req, res) => {
    try {
        const response = await axios.get(`${PREDICTION_SERVICE_URL}/api/teams`);
        return res.json(response.data);
    } catch (error) {
        console.error('Teams fetch error:', error.message);
        return res.status(500).json({ error: 'Failed to fetch teams' });
    }
});


app.get('/api/fixtures', async (req, res) => {
    try {
        const api = new FootballDataOrgAPI(process.env.API_KEY);
        const thisWeeksMatches = await api.getMatchesForTheWeek();
        return res.json(thisWeeksMatches);
    } catch (error) {
        console.error('Fixtures fetch error:', error.message);
        return res.status(500).json({ error: 'Failed to fetch fixtures of the week.' });
    }
})

app.get('/api/team-form/:teamName', async (req, res) => {
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

app.get('/health', async (req, res) => {
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

startPredictionService();

waitForPredictionService().then(() => {
    app.listen(port, hostname, () => {

        console.log(`Server running at http://${hostname}:${port}/`);
    });
});
