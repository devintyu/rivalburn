export const config = { runtime: 'edge' };

const FOOTBALL_API = 'https://api.football-data.org/v4';
const WC_CODE = 'WC'; // football-data.org uses 'WC' for FIFA World Cup

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 's-maxage=60, stale-while-revalidate=30',
  };

  try {
    const apiKey = process.env.FOOTBALL_API_KEY;
    if (!apiKey) throw new Error('FOOTBALL_API_KEY not set');

    // Fetch matches and standings in parallel
    const [matchesRes, standingsRes] = await Promise.all([
      fetch(`${FOOTBALL_API}/competitions/${WC_CODE}/matches`, {
        headers: { 'X-Auth-Token': apiKey }
      }),
      fetch(`${FOOTBALL_API}/competitions/${WC_CODE}/standings`, {
        headers: { 'X-Auth-Token': apiKey }
      }),
    ]);

    // Log status codes for debugging
    console.log('Matches status:', matchesRes.status);
    console.log('Standings status:', standingsRes.status);

    if (!matchesRes.ok) {
      const errText = await matchesRes.text();
      throw new Error(`Matches API ${matchesRes.status}: ${errText}`);
    }

    const matchesData = await matchesRes.json();
    const standingsData = standingsRes.ok ? await standingsRes.json() : { standings: [] };

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const allMatches = matchesData.matches || [];

    const live = allMatches.filter(m =>
      ['IN_PLAY','PAUSED','LIVE'].includes(m.status)
    );

    const today = allMatches.filter(m =>
      m.utcDate.startsWith(todayStr) && m.status === 'SCHEDULED'
    );

    const recent = allMatches.filter(m => {
      const d = new Date(m.utcDate);
      const diffHours = (now - d) / (1000*60*60);
      return diffHours >= 0 && diffHours <= 72 && m.status === 'FINISHED';
    }).slice(0, 8);

    const upcoming = allMatches.filter(m => {
      const d = new Date(m.utcDate);
      const diffHours = (d - now) / (1000*60*60);
      return diffHours > 0 && diffHours <= 96 && m.status === 'SCHEDULED';
    }).slice(0, 8);

    const groups = (standingsData.standings || []).map(g => ({
      group: g.group || g.stage,
      table: (g.table || []).slice(0, 4).map(t => ({
        pos: t.position,
        team: t.team.name,
        flag: getFlagEmoji(t.team.name),
        played: t.playedGames,
        won: t.won,
        drawn: t.draw,
        lost: t.lost,
        gf: t.goalsFor,
        ga: t.goalsAgainst,
        pts: t.points,
      }))
    }));

    return new Response(JSON.stringify({
      live, today, recent, upcoming, groups,
      total: allMatches.length,
      updated: now.toISOString(),
    }), { status: 200, headers });

  } catch (err) {
    console.error('Scores API error:', err.message);
    return new Response(JSON.stringify({
      error: 'Failed to fetch scores',
      detail: err.message,
      live: [], today: [], recent: [], upcoming: [], groups: []
    }), { status: 200, headers }); // return 200 so frontend handles gracefully
  }
}

function getFlagEmoji(name) {
  const map = {
    'Mexico':'🇲🇽','South Africa':'🇿🇦','Korea Republic':'🇰🇷','South Korea':'🇰🇷',
    'Czechia':'🇨🇿','Czech Republic':'🇨🇿',
    'Canada':'🇨🇦','Bosnia and Herzegovina':'🇧🇦','Qatar':'🇶🇦','Switzerland':'🇨🇭',
    'Brazil':'🇧🇷','Morocco':'🇲🇦','Haiti':'🇭🇹','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'United States':'🇺🇸','Paraguay':'🇵🇾','Australia':'🇦🇺','Turkey':'🇹🇷','Türkiye':'🇹🇷',
    'Germany':'🇩🇪','Curaçao':'🇨🇼',"Côte d'Ivoire":'🇨🇮','Ivory Coast':'🇨🇮','Ecuador':'🇪🇨',
    'Netherlands':'🇳🇱','Japan':'🇯🇵','Tunisia':'🇹🇳','Sweden':'🇸🇪',
    'Belgium':'🇧🇪','Egypt':'🇪🇬','Iran':'🇮🇷','Islamic Republic of Iran':'🇮🇷','New Zealand':'🇳🇿',
    'Spain':'🇪🇸','Cabo Verde':'🇨🇻','Cape Verde':'🇨🇻','Saudi Arabia':'🇸🇦','Uruguay':'🇺🇾',
    'France':'🇫🇷','Senegal':'🇸🇳','Iraq':'🇮🇶','Norway':'🇳🇴',
    'Argentina':'🇦🇷','Algeria':'🇩🇿','Austria':'🇦🇹','Jordan':'🇯🇴',
    'Portugal':'🇵🇹','DR Congo':'🇨🇩','Congo DR':'🇨🇩','Uzbekistan':'🇺🇿','Colombia':'🇨🇴',
    'England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Croatia':'🇭🇷','Ghana':'🇬🇭','Panama':'🇵🇦',
  };
  return map[name] || '🏳️';
}

export default async function handler(req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 's-maxage=120, stale-while-revalidate=60', // cache 2 mins
  };

  try {
    const apiKey = process.env.FOOTBALL_API_KEY;

    // Fetch in parallel: matches today + standings
    const [matchesRes, standingsRes] = await Promise.all([
      fetch(`${FOOTBALL_API}/competitions/${WC2026_ID}/matches?status=LIVE,IN_PLAY,PAUSED,FINISHED,SCHEDULED&limit=20`, {
        headers: { 'X-Auth-Token': apiKey }
      }),
      fetch(`${FOOTBALL_API}/competitions/${WC2026_ID}/standings`, {
        headers: { 'X-Auth-Token': apiKey }
      }),
    ]);

    const matchesData = await matchesRes.json();
    const standingsData = await standingsRes.json();

    // Process matches
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const allMatches = matchesData.matches || [];

    // Separate live, today, recent (last 3 days), upcoming (next 3 days)
    const live = allMatches.filter(m => ['IN_PLAY','PAUSED','LIVE'].includes(m.status));
    const today = allMatches.filter(m => m.utcDate.startsWith(todayStr) && m.status === 'SCHEDULED');
    const recent = allMatches.filter(m => {
      const d = new Date(m.utcDate);
      const diff = (now - d) / (1000*60*60*24);
      return diff <= 3 && diff >= 0 && m.status === 'FINISHED';
    }).slice(0, 6);
    const upcoming = allMatches.filter(m => {
      const d = new Date(m.utcDate);
      const diff = (d - now) / (1000*60*60*24);
      return diff > 0 && diff <= 3 && m.status === 'SCHEDULED';
    }).slice(0, 6);

    // Process standings — top 2 per group
    const groups = (standingsData.standings || []).map(g => ({
      group: g.group || g.stage,
      table: (g.table || []).slice(0, 4).map(t => ({
        pos: t.position,
        team: t.team.name,
        flag: getFlagEmoji(t.team.name),
        played: t.playedGames,
        won: t.won,
        drawn: t.draw,
        lost: t.lost,
        gf: t.goalsFor,
        ga: t.goalsAgainst,
        pts: t.points,
      }))
    }));

    return new Response(JSON.stringify({
      live,
      today,
      recent,
      upcoming,
      groups,
      updated: now.toISOString(),
    }), { status: 200, headers });

  } catch (err) {
    console.error('Scores API error:', err);
    return new Response(JSON.stringify({ error: 'Failed to fetch scores', detail: err.message }), {
      status: 500, headers
    });
  }
}

// Map team names to flag emojis
function getFlagEmoji(name) {
  const map = {
    'Mexico': '🇲🇽', 'South Africa': '🇿🇦', 'Korea Republic': '🇰🇷', 'South Korea': '🇰🇷',
    'Czechia': '🇨🇿', 'Czech Republic': '🇨🇿',
    'Canada': '🇨🇦', 'Bosnia and Herzegovina': '🇧🇦', 'Qatar': '🇶🇦', 'Switzerland': '🇨🇭',
    'Brazil': '🇧🇷', 'Morocco': '🇲🇦', 'Haiti': '🇭🇹', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'United States': '🇺🇸', 'USA': '🇺🇸', 'Paraguay': '🇵🇾', 'Australia': '🇦🇺', 'Turkey': '🇹🇷',
    'Germany': '🇩🇪', 'Curaçao': '🇨🇼', "Côte d'Ivoire": '🇨🇮', 'Ivory Coast': '🇨🇮', 'Ecuador': '🇪🇨',
    'Netherlands': '🇳🇱', 'Japan': '🇯🇵', 'Tunisia': '🇹🇳', 'Sweden': '🇸🇪',
    'Belgium': '🇧🇪', 'Egypt': '🇪🇬', 'Iran': '🇮🇷', 'New Zealand': '🇳🇿',
    'Spain': '🇪🇸', 'Cabo Verde': '🇨🇻', 'Saudi Arabia': '🇸🇦', 'Uruguay': '🇺🇾',
    'France': '🇫🇷', 'Senegal': '🇸🇳', 'Iraq': '🇮🇶', 'Norway': '🇳🇴',
    'Argentina': '🇦🇷', 'Algeria': '🇩🇿', 'Austria': '🇦🇹', 'Jordan': '🇯🇴',
    'Portugal': '🇵🇹', 'DR Congo': '🇨🇩', 'Uzbekistan': '🇺🇿', 'Colombia': '🇨🇴',
    'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Croatia': '🇭🇷', 'Ghana': '🇬🇭', 'Panama': '🇵🇦',
  };
  return map[name] || '🏳️';
}
