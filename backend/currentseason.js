class FootballDataOrgAPI {
  constructor(apiKey) {
    this.apiKey = apiKey; // Got free key from football-data.org
    this.baseUrl = 'https://api.football-data.org/v4';
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

  parseMatches(data) {
    if (!data || !data.matches) return [];

    return data.matches.map(match => ({
      competition: data.competition,
      season: match.season.startDate.substring(0, 4),
      round: match.matchday,
      date: match.utcDate,
      homeTeam: match.homeTeam.name,
      awayTeam: match.awayTeam.name,
      score: [match.score.fullTime.home,
      match.score.fullTime.away],
      status: match.status
    }));
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