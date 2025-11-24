import dotenv from 'dotenv'
import express from 'express';
import { getPastResults } from './pastresults.js';
import fs from 'fs'

dotenv.config()

const hostname = process.env.SERVER_HOST || '127.0.0.1';
const port = process.env.SERVER_PORT || 3000;

const app = express();

app.use(express.json());

app.get('/', async (req, res) => {
    const allData = await getPastResults();
    
    return res.json(allData);
});

app.listen(port, hostname, () => {
  console.log(`Server running at http://${process.env.SERVER_HOST}:${process.env.SERVER_PORT}/`);
});
