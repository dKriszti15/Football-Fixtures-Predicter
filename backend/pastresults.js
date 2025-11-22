import axios from "axios";
import dotenv from 'dotenv'

dotenv.config()

const leagues = [
    'en.1',
    'es.1',
    'it.1',
    'de.1',
    'fr.1',
    'uefa.cl'
]

const seasons = [
    "2022-23",
    "2023-24",
    "2024-25"
]

const API_KEY = process.env.API_KEY;
const API_BASE_URL = process.env.API_BASE_URL;

const competitionMapping = {
    'en.1': { apiCode: 'PL', name: 'Premier League 2025/2026' },
    'es.1': { apiCode: 'PD', name: 'La Liga 2025/2026' },
    'it.1': { apiCode: 'SA', name: 'Serie A 2025/2026' },
    'de.1': { apiCode: 'BL1', name: 'Bundesliga 2025/2026' },
    'fr.1': { apiCode: 'FL1', name: 'Ligue 1 2025/2026' },
    'uefa.cl': { apiCode: 'CL', name: 'UEFA Champions League 2025/2026' }
};

export async function getLeagueData(league, season) {
    try {
        const response = await axios.get(`https://raw.githubusercontent.com/openfootball/football.json/master/${season}/${league}.json`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching data for ${league} in ${season}:`, error.message);
        return null;
    }
}

async function getCurrentSeasonData(league) {
    const mapping = competitionMapping[league];
    if (!mapping) return null;

    try {
        const response = await axios.get(`${API_BASE_URL}/competitions/${mapping.apiCode}/matches`, {
            headers: { 'X-Auth-Token': API_KEY },
            params: { season: 2025 }
        });
        
        return {
            name: mapping.name,
            matches: response.data.matches.map(match => ({
                date: match.utcDate,
                team1: match.homeTeam.name,
                team2: match.awayTeam.name,
                score: {
                    ft: match.score.fullTime.home !== null && match.score.fullTime.away !== null
                        ? [match.score.fullTime.home, match.score.fullTime.away]
                        : 'SCHEDULED'
                }
            }))
        };
    } catch (error) {
        console.error(`Error fetching current season for ${league}:`, error.message);
        return null;
    }
}

export async function getAllResults() {
    let allData = [];

    for (const league of leagues) {
        console.log(`Fetching ${league}...`);
        
        for (const season of seasons) {
            const response = await getLeagueData(league, season);
            if (response) {
                allData.push({ ...response, season });
            }
        }
        
        const currentSeason = await getCurrentSeasonData(league);
        if (currentSeason) {
            allData.push(currentSeason);
        }
        
        await sleep(500);
    }
    
    const matches = parseMatches(allData);
    return matches;
}

export async function getPastResults() {
    return getAllResults();
}

function parseMatches(data) {
    const matches = {};
    data.forEach(league => {
        if (!league) return;
        
        if (!matches[league.name]) {
            matches[league.name] = [];
        }
        
        league.matches.forEach(match => {
            const score = match.score?.ft 
                ? (Array.isArray(match.score.ft) ? match.score.ft : 'SCHEDULED')
                : 'SCHEDULED';
                
            matches[league.name].push({
                date: match.date,
                home_team: match.team1,
                away_team: match.team2,
                score: score
            });
        });
    });
    
    return matches;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
