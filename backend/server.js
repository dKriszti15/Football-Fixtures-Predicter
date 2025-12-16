import dotenv from 'dotenv'
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { router } from './router/router.js';
import { startPredictionService, waitForPredictionService } from './service/predictionService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config()

const hostname = process.env.SERVER_HOST || '127.0.0.1';
const port = process.env.SERVER_PORT || 4000;

let predictionServiceProcess = null;

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

app.use(cors());
app.use(express.json());

app.use(router);

startPredictionService();

waitForPredictionService().then(() => {
    app.listen(port, hostname, () => {

        console.log(`Server running at http://${hostname}:${port}/`);
    });
});
