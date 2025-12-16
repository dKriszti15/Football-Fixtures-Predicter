import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_BASE_URL;

class FootballDataOrgAPI {
  constructor(apiKey) {
    this.apiKey = apiKey; // Got free key from football-data.org
    this.baseUrl = API_BASE_URL;
    this.rateLimit = 10; // per minute (free version)
    this.requestCount = 0;
    this.requestWindow = Date.now();
  }

  // comp id-s for football-data.org
  getCompetitionIds() {
    return {
      'Premier League': 'PL',
      'La Liga': 'PD',
      'Bundesliga': 'BL1',
      'Ligue 1': 'FL1',
      'Serie A': 'SA',
      'Champions League': 'CL',
      'Europa League': 'EL'
    };
  }

  async checkRateLimit() {
    const now = Date.now();
    if (now - this.requestWindow >= 60000) {
      this.requestCount = 0;
      this.requestWindow = now;
    }

    if (this.requestCount >= this.rateLimit) {
      const waitTime = 60000 - (now - this.requestWindow);
      console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
      await this.sleep(waitTime);
      this.requestCount = 0;
      this.requestWindow = Date.now();
    }

    this.requestCount++;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchMatches(competition, dateFrom = null, dateTo = null) {
    await this.checkRateLimit();

    const competitionId = this.getCompetitionIds()[competition];
    if (!competitionId) {
      console.log(`${competition} not available in football-data.org`);
      return null;
    }

    try {
      let url = `${this.baseUrl}/competitions/${competitionId}/matches`;
      const params = new URLSearchParams();
      
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      
      if (params.toString()) url += `?${params.toString()}`;

      const response = await axios.get(url, {
        headers: {
          'X-Auth-Token': this.apiKey
        }
      });

      return {
        competition,
        matches: response.data.matches
      };
    } catch (error) {
      console.error(`Error fetching ${competition}:`, error.message);
      return null;
    }
  }

  async getMatchesForTheWeek(){
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dateFrom = today.toISOString().split('T')[0];
    
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 2);
    nextWeek.setHours(23, 59, 59, 999);
    const dateTo = nextWeek.toISOString().split('T')[0];

    console.log(`Fetching upcoming matches: ${dateFrom} to ${dateTo}`);
    
    const competitions = Object.keys(this.getCompetitionIds());
    const allMatches = [];
    
    for (const competition of competitions) {
      const data = await this.fetchMatches(competition, dateFrom, dateTo);
      if (data) {
          const matches = this.parseMatches(data);
        
          // only upcoming matches by date range (next 7 days)
          const upcomingMatches = matches.filter(m => {
          const matchDate = new Date(m.date);
          const isInRange = matchDate >= today && matchDate <= nextWeek;
          const isScheduled = m.score === 'SCHEDULED';
          
          return isInRange && isScheduled;
        });
        
        console.log(`${competition}: Found ${upcomingMatches.length} upcoming matches`);
        allMatches.push(...upcomingMatches);
      }
    }
    
    allMatches.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log(`Total upcoming matches: ${allMatches.length}`);
    
    return allMatches;
  }

  parseMatches(data) {
    if (!data || !data.matches) return [];

    return data.matches.map(match => {
      const score = match.score.fullTime.home !== null && match.score.fullTime.away !== null
        ? [match.score.fullTime.home, match.score.fullTime.away]
        : 'SCHEDULED';
      
      let result = null;
      if (Array.isArray(score)) {
        result = score[0] > score[1] ? 1 : score[0] === score[1] ? 2 : 0;
      }

      return {
        date: match.utcDate.split('T')[0],
        competition: data.competition,
        home_team: match.homeTeam.name,
        away_team: match.awayTeam.name,
        score: score,
        result: result
      };
    });
  }

  async fetchStandings(competition) {
    await this.checkRateLimit();

    const competitionId = this.getCompetitionIds()[competition];
    if (!competitionId) return null;

    try {
      const url = `${this.baseUrl}/competitions/${competitionId}/standings`;
      const response = await axios.get(url, {
        headers: {
          'X-Auth-Token': this.apiKey
        }
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching standings for ${competition}:`, error.message);
      return null;
    }
  }
}

export { FootballDataOrgAPI }