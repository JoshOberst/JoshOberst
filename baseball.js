const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdTK9Y2OsQTjWCNXjc2tx6OTfAM0vDA_t1o82WRkbf_xj-9Pipnu-DC4wDXDso2J3kQz23pEyN30Fh/pub?output=csv";

const TEAM_MAP = {
  "Yankees": "New York Yankees",
  "Red Sox": "Boston Red Sox",
  "Blue Jays": "Toronto Blue Jays",
  "Orioles": "Baltimore Orioles",
  "Rays": "Tampa Bay Rays",
  "Rangers": "Texas Rangers",
  "White Sox": "Chicago White Sox",
  "Twins": "Minnesota Twins",
  "Guardians": "Cleveland Guardians",
  "Royals": "Kansas City Royals",
  "Athletics": "Oakland Athletics",
  "Angels": "Los Angeles Angels",
  "Mariners": "Seattle Mariners",
  "Diamondbacks": "Arizona Diamondbacks",
  "Rockies": "Colorado Rockies",
  "Dodgers": "Los Angeles Dodgers",
  "Giants": "San Francisco Giants",
  "Padres": "San Diego Padres",
  "Cubs": "Chicago Cubs",
  "Brewers": "Milwaukee Brewers",
  "Pirates": "Pittsburgh Pirates",
  "Cardinals": "St. Louis Cardinals",
  "Mets": "New York Mets",
  "Phillies": "Philadelphia Phillies",
  "Nationals": "Washington Nationals",
  "Marlins": "Miami Marlins",
  "Reds": "Cincinnati Reds",
  "Tigers": "Detroit Tigers",
  "Braves": "Atlanta Braves"
};

let games = [];
let gamePkCache =
 JSON.parse(localStorage.getItem("gamePkCache"))
 || {};

async function loadGames() {
  const res = await fetch(CSV_URL);
  const text = await res.text();
  const rows = text.trim().split("\n");
  const headers = rows.shift().split(",").map(h => h.trim());

  games = rows.map(r => {
    const values = r.split(",");
    const obj = {};
    headers.forEach((h,i)=> obj[h] = values[i]?.trim());
    obj.awayScore = parseInt(obj.AwayScore);
    obj.homeScore = parseInt(obj.HomeScore);
    // Only count wins/losses when Yankees are playing
    if(obj.Home === "Yankees" || obj.Away === "Yankees") {
      obj.yankeesWin = (obj.Home === "Yankees" && obj.homeScore > obj.awayScore) ||
                       (obj.Away === "Yankees" && obj.awayScore > obj.homeScore);
    } else {
      obj.yankeesWin = null; // ignore other games
    }
    return obj;
  });

  // Sort by date descending
  games.sort((a,b)=> new Date(b.Date) - new Date(a.Date));

  renderTable();
  updateLeaderboards(); // auto-generate leaderboards
  generateStadiumLeaderboard();
  generateGameHighlights();
}

function renderTable() {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";
  games.forEach(g => {
    const rowClass =
      g.Postseason === "Yes"
      ? "postseasonRow"
      : "";

      const typeLabel =
      g.Postseason === "Yes"
      ? "🏆 " + (g.Round || "Post")
      : "⚾ Reg";

      tbody.innerHTML += `<tr class="${rowClass}">
          <td>${typeLabel}</td>
          <td>${g.Date}</td>
          <td>${g.Away}</td>
          <td>${g.Home}</td>
          <td>${g.awayScore}-${g.homeScore}</td>
          <td>${g.Stadium}</td>
        </tr>`;
  });
  document.getElementById("count").textContent = games.length;
  updateYankeesRecord();
}

function updateYankeesRecord(){

 let regWins=0;
 let regLosses=0;

 let postWins=0;
 let postLosses=0;

 games.forEach(g=>{

  if(g.yankeesWin === null)
   return;

  const isPost =
   g.Postseason === "Yes";

  if(isPost){
   if(g.yankeesWin)
    postWins++;
   else
    postLosses++;
  }else{
   if(g.yankeesWin)
    regWins++;
   else
    regLosses++;
  }
 });

 document.getElementById(
  "yankeesRecord"
 ).innerHTML =

  `Regular Season: ${regWins}-${regLosses}
   <br>
   Postseason: ${postWins}-${postLosses}`;

}

function formatPlayerName(name){

 const MAX_LENGTH = 18;

 if(name.length <= MAX_LENGTH)
  return name;

 const parts = name.split(" ");

 if(parts.length < 2)
  return name;

 const firstInitial =
  parts[0][0];

 const lastName =
  parts.slice(1).join(" ");

 return firstInitial + ". " + lastName;
}

function generateStadiumLeaderboard(){
  const stadiumCounts = {};
  games.forEach(g=>{
  const stadium = g.Stadium;
  if(!stadiumCounts[stadium])
    stadiumCounts[stadium]=0;
    stadiumCounts[stadium]++;
  });
  const sorted = Object.entries(stadiumCounts)
  .sort((a,b)=>b[1]-a[1]);
  let html =`<div class="stadiumBox"><b>🏟 Stadiums Visited</b><ol>`;
  sorted.forEach(s=>{
  html +=
   `<li>${s[0]} — ${s[1]}</li>`;
  });
  html +="</ol></div>";document.getElementById("stadiumLeaders").innerHTML = html;
}

async function attachGamePks(){

  const unmatched = [];

  const promises = games.map(async game => {

    if(game.gamePk) return;

    try{

      const res = await fetch(
        `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=${game.Date}`
      );

      const data = await res.json();

      if(!data.dates.length) return;

      const awayName = TEAM_MAP[game.Away] || game.Away;
      const homeName = TEAM_MAP[game.Home] || game.Home;

      const found = data.dates[0].games.find(g =>

        g.teams.away.team.name
          .toLowerCase().trim() ===
        awayName.toLowerCase().trim()

        &&

        g.teams.home.team.name
          .toLowerCase().trim() ===
        homeName.toLowerCase().trim()

      );

      if(found){

        game.gamePk = found.gamePk;

      }else{

        unmatched.push({
          Date: game.Date,
          Away: game.Away,
          Home: game.Home
        });

      }

    }catch(e){

      console.log("Error loading game",game);

    }

  });

  await Promise.all(promises);

}

function inningsToOuts(ipString){

 if(!ipString) return 0;

 const parts =
  ipString.split(".");

 const innings =
  parseInt(parts[0]) || 0;

 const outs =
  parseInt(parts[1]) || 0;

 return innings*3 + outs;

}

async function generateLeaderboards() {
  const stats = {};
  for (const game of games) {
    if(!game.gamePk) continue;
    const res = await fetch(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`);
    const data = await res.json();
    const teams = data.liveData.boxscore.teams;

    ["home","away"].forEach(side => {
      Object.values(teams[side].players).forEach(p=>{
        const name = p.person.fullName;
        if(!stats[name]) stats[name]={hits:0, atBats:0, ks:0, ip:0, hr:0, hbp:0, walks:0};
        const b = p.stats?.batting;
        const pi = p.stats?.pitching;
        if(b){ 
          stats[name].hits += b.hits || 0;
          stats[name].atBats += b.atBats || 0;
          stats[name].hr += b.homeRuns || 0;
          stats[name].hbp += b.hitByPitch || 0;
          stats[name].walks += b.baseOnBalls || 0; // walks
        }
        if(pi){
          stats[name].ks += pi.strikeOuts || 0;
          stats[name].ip += inningsToOuts(pi.inningsPitched);
        }
      });
    });
  }

  const players = Object.entries(stats).map(([name,s])=>({
    name, hits:s.hits, atBats:s.atBats, ks:s.ks, ip:s.ip,ipDisplay: Math.floor(s.ip/3) + "." + (s.ip%3), hr:s.hr, walks:s.walks, hbp:s.hbp, avg:s.atBats>0?s.hits/s.atBats:0
  }));

  const topHits   = [...players].sort((a,b)=>b.hits-a.hits).slice(0,10);
  const topKs     = [...players].sort((a,b)=>b.ks-a.ks).slice(0,10);
  const topAB     = [...players].sort((a,b)=>b.atBats-a.atBats).slice(0,10);
  const topAVG    = [...players].filter(p=>p.atBats>=10).sort((a,b)=>b.avg-a.avg).slice(0,10);
  const topIP     = [...players].sort((a,b)=>b.ip-a.ip).slice(0,10);
  const topHR     = [...players].sort((a,b)=>b.hr-a.hr).slice(0,10);
  const topWalks  = [...players].sort((a,b)=>b.walks-a.walks).slice(0,10);
  const topHBP    = [...players].sort((a,b)=>b.hbp-a.hbp).slice(0,10);

  function renderList(title,list,formatter){
    let icon = "";
    if(title.includes("Hits")) icon = "⚾";
    if(title.includes("Strikeouts")) icon = "🏆";
    if(title.includes("At Bats")) icon = "📝";
    if(title.includes("Batting Average")) icon = "📊";
    if(title.includes("Innings Pitched")) icon = "🎯";
    if(title.includes("Home Runs")) icon = "💥";
    if(title.includes("Walks")) icon = "🏃";
    if(title.includes("Hit By Pitch")) icon = "🤕";

    let html = `<div class="leaderboardBox"><h3>${icon} ${title}</h3><ol>`;
    list.forEach(p=>html+=`<li style="display:flex; justify-content:space-between;"><span>${formatPlayerName(p.name)}</span><span>${formatter(p)}</span></li>`);
    html += "</ol></div>";
    return html;
  }

  document.getElementById("leadersContainer").innerHTML =
    renderList("Top 10 Hits",topHits,p=>p.hits) +
    renderList("Top 10 Strikeouts (Pitching)",topKs,p=>p.ks) +
    renderList("Top 10 At Bats",topAB,p=>p.atBats) +
    renderList("Top 10 Batting Average (Min 10 AB)",topAVG,p=>p.avg.toFixed(3)) +
    renderList( "Top 10 Innings Pitched", topIP, p=>p.ipDisplay) +
    renderList("Top 10 Home Runs",topHR,p=>p.hr) +
    renderList("Top 10 Walks",topWalks,p=>p.walks) +
    renderList("Top 10 Hit By Pitch",topHBP,p=>p.hbp);
}

async function generateGameHighlights(){

 await attachGamePks();

 let bestHitting = null;
 let bestPitching = null;

 for(const game of games){

  if(!game.gamePk) continue;

  const res = await fetch(
   `https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`
  );

  const data = await res.json();

  const teams =
   data.liveData.boxscore.teams;

  ["home","away"].forEach(side => {

   const players =
    teams[side].players;

   Object.values(players).forEach(p=>{

    const name =
     p.person.fullName;

    const batting =
     p.stats?.batting;

    const pitching =
     p.stats?.pitching;

    // 🔥 INDIVIDUAL HITTING
    if(batting && batting.atBats > 0){

     const hits = batting.hits || 0;
     const hr   = batting.homeRuns || 0;
     const rbi  = batting.rbi || 0;
     const runs = batting.runs || 0;

     // weighted scoring formula
     const score =
      (hits)
      + (3*hr)
      + (2*rbi)
      + (runs);

     if(!bestHitting ||
        score > bestHitting.score){

      bestHitting = {
       name,
       score,
       game,
       hits,
       hr,
       rbi,
       runs
      };

     }

    }

    // 🎯 INDIVIDUAL PITCHING
    if(pitching && pitching.inningsPitched){

     const outs =
      inningsToOuts(
       pitching.inningsPitched
      );

     const ks =
      pitching.strikeOuts || 0;

     const earnedRuns =
      pitching.earnedRuns || 0;

     // reward Ks + outs, penalize ER
     const score =
      (2*outs)
      + (3*ks)
      - (3*earnedRuns);

     if(!bestPitching ||
        score > bestPitching.score){

      bestPitching = {
       name,
       score,
       game,
       ks,
       ip: pitching.inningsPitched,
       er: earnedRuns
      };

     }

    }

   });

  });

 }

 let html = "";

 if(bestHitting){

  html += `
   <div class="stadiumBox">
   <b>🔥 Best Individual Hitting Game</b><br>
   ${formatPlayerName(bestHitting.name)}<br>
   ${bestHitting.hits} H,
   ${bestHitting.hr} HR,
   ${bestHitting.rbi} RBI,
   ${bestHitting.runs} R<br>
   ${bestHitting.game.Date} —
   ${bestHitting.game.Away} vs
   ${bestHitting.game.Home}
   </div>
  `;

 }

 if(bestPitching){

  html += `
   <div class="stadiumBox">
   <b>🎯 Best Individual Pitching Game</b><br>
   ${formatPlayerName(bestPitching.name)}<br>
   ${bestPitching.ip} IP,
   ${bestPitching.ks} K,
   ${bestPitching.er} ER<br>
   ${bestPitching.game.Date} —
   ${bestPitching.game.Away} vs
   ${bestPitching.game.Home}
   </div>
  `;

 }

 document.getElementById(
  "gameHighlights"
 ).innerHTML = html;

}

async function updateLeaderboards(){

  const CACHE_KEY = "mlbStatsCache";
  const CACHE_TIME_KEY = "mlbStatsCacheTime";

  const ONE_DAY = 86400000;

  const leaders =
    document.getElementById("leadersContainer");

  // Show loading message
  leaders.innerHTML =
   "<b>Loading player stats...</b>";

  const cached =
    localStorage.getItem(CACHE_KEY);

  const cacheTime =
    localStorage.getItem(CACHE_TIME_KEY);

  if(cached && cacheTime){

    const age =
      Date.now() - cacheTime;

    if(age < ONE_DAY){

      console.log(
       "Using cached leaderboards"
      );

      leaders.innerHTML =
        cached;

      return;
    }
  }

  console.log("Building leaderboards");

  await attachGamePks();

  await generateLeaderboards();

  localStorage.setItem(
    CACHE_KEY,
    leaders.innerHTML
  );

  localStorage.setItem(
    CACHE_TIME_KEY,
    Date.now()
  );
}

loadGames();