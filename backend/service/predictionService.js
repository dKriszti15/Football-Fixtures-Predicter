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

export async function waitForPredictionService(maxAttempts = 30, interval = 1000) {
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