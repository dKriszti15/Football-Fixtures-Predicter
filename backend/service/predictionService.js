import dotenv from 'dotenv'
import { getPastResults } from './pastresults.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config()

const PREDICTION_SERVICE_URL = process.env.PREDICTION_SERVICE_URL || 'http://localhost:5001';

let predictionServiceProcess = null;

export function startPredictionService() {
    const predictionServicePath = path.join(__dirname, '..', '..', 'prediction-service');
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

async function fetchAndCacheMatches() {
    const today = new Date().toISOString().split('T')[0];
    const matchFile = 'matches.json';
    const cacheFile = 'cache.json';
    
    try {
        // check if cache exists from today
        if (fs.existsSync(cacheFile)) {
            const metadata = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
            if (metadata.lastFetchDate === today) {
                console.log('Using cached matches data from today');
                return;
            }
        }
    } catch (error) {
        console.log('No valid cache found, fetching new data...');
    }
    
    console.log('Fetching match results...');
    const allData = await getPastResults();
    
    fs.writeFileSync(matchFile, JSON.stringify(allData, null, 2), 'utf8');
    
    fs.writeFileSync(cacheFile, JSON.stringify({
        lastFetchDate: today,
        totalMatches: allData.length,
        lastUpdated: new Date().toISOString()
    }, null, 2), 'utf8');
    
    console.log(`Fetched and cached ${allData.length} matches`);
}

export async function waitForPredictionService(maxAttempts = 30, interval = 1000) {

    await fetchAndCacheMatches();
    
    for (let i = 0; i < maxAttempts; i++) {
        try {
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