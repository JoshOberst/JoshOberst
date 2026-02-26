const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdTK9Y2OsQTjWCNXjc2tx6OTfAM0vDA_t1o82WRkbf_xj-9Pipnu-DC4wDXDso2J3kQz23pEyN30Fh/pub?output=csv";

let currentMode = "modern";


const STAT_MODES = {

  classic: {
    hitting: [
      { key:"avg", label:"AVG", minAB:10, type:"rate" },
      { key:"hr", label:"HR", type:"count" },
      { key:"rbi", label:"RBI", type:"count" },
      { key:"hits", label:"Hits", type:"count" }
    ],
    pitching: [
      { key:"wins", label:"Wins", type:"count" },
      { key:"era", label:"ERA", minIP:5, type:"rate" },
      { key:"ks", label:"Strikeouts", type:"count" },
      { key:"ip", label:"Innings Pitched", type:"count" }
    ]
  },

  modern: {
    hitting: [
      { key:"obp", label:"OBP", minAB:10, type:"rate" },
      { key:"hr", label:"HR", type:"count" },
      { key:"ops", label:"OPS", minAB:10, type:"rate" },
      { key:"slg", label:"SLG", minAB:10, type:"rate" }
    ],
    pitching: [
      { key:"whip", label:"WHIP", minIP:5, type:"rate" },
      { key:"era", label:"ERA", minIP:5, type:"rate" },
      { key:"ks", label:"Strikeouts", type:"count" },
      { key:"kbb", label:"K/BB", minIP:5, type:"rate" }
    ]
  },

  fun: {
    hitting: [
      { key:"walks", label:"Walks", type:"count" },
      { key:"hbp", label:"HBP", type:"count" },
      { key:"xbh", label:"XBH", type:"count" },
      { key:"sb", label:"Stolen Bases", type:"count" }
    ],
    pitching: [
      { key:"saves", label:"Saves", type:"count" },
      { key:"hitBatters", label:"Hit Batters", type:"count" },
      { key:"wildPitches", label:"Wild Pitches", type:"count" },
      { key:"bf", label:"Batters Faced (Pitch Count)", type:"special" }
    ]
  }

};

const STAT_ICONS = {

  // Hitting - Classic / Modern
  avg: "📊",
  obp: "🧠",
  slg: "💪",
  ops: "🔥",
  hr: "💣",
  rbi: "🎯",
  hits: "⚾",

  // Hitting - Fun
  walks: "🚶",
  hbp: "🤕",
  sb: "🚀",
  xbh: "💥",

  // Pitching - Classic / Modern
  wins: "🏆",
  era: "📉",
  whip: "🧊",
  ks: "🥊",
  kbb: "⚖️",
  ip: "⏱",

  // Pitching - Fun
  saves: "🔒",
  hitBatters: "💢",
  wildPitches: "😵",
  bf: "📦"

};

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

function renderList(title, list, formatter, statKey){

  const icon = STAT_ICONS[statKey] || "";

  let html = `
    <div class="leaderboardBox">
      <h3>${icon} ${title}</h3>
      <ol>
  `;

  list.forEach(p=>{
    html += `
      <li style="display:flex; justify-content:space-between;">
        <span>${formatPlayerName(p.name)}</span>
        <span>${formatter(p)}</span>
      </li>
    `;
  });

  html += "</ol></div>";

  return html;
}

function setMode(mode){

 currentMode = mode;

 generateLeaderboards();

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

    const res = await fetch(
      `https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`
    );

    const data = await res.json();
    const teams = data.liveData.boxscore.teams;

    ["home","away"].forEach(side => {

      Object.values(teams[side].players).forEach(p=>{

        const name = p.person.fullName;

        if(!stats[name]){
          stats[name]={
            hits:0, doubles:0, triples:0, hr:0, rbi:0,
            atBats:0, walks:0, hbp:0, sb:0,
            ks:0, ip:0, er:0,
            hitsAllowed:0, walksAllowed:0,
            wins:0, saves:0,
            hitBatters:0, wildPitches:0,
            battersFaced:0, pitches:0
          };
        }

        const b = p.stats?.batting;
        const pi = p.stats?.pitching;

        if(b){
          stats[name].hits += b.hits || 0;
          stats[name].doubles += b.doubles || 0;
          stats[name].triples += b.triples || 0;
          stats[name].hr += b.homeRuns || 0;
          stats[name].rbi += b.rbi || 0;
          stats[name].atBats += b.atBats || 0;
          stats[name].walks += b.baseOnBalls || 0;
          stats[name].hbp += b.hitByPitch || 0;
          stats[name].sb += b.stolenBases || 0;
        }

        if(pi){
          stats[name].ks += pi.strikeOuts || 0;
          stats[name].ip += inningsToOuts(pi.inningsPitched);
          stats[name].er += pi.earnedRuns || 0;
          stats[name].hitsAllowed += pi.hits || 0;
          stats[name].walksAllowed += pi.baseOnBalls || 0;
          stats[name].wins += pi.wins || 0;
          stats[name].saves += pi.saves || 0;
          stats[name].hitBatters += pi.hitBatsmen || 0;
          stats[name].wildPitches += pi.wildPitches || 0;
          stats[name].battersFaced += pi.battersFaced || 0;
          stats[name].pitches += pi.numberOfPitches || 0;
        }

      });

    });

  }

  const players = Object.entries(stats).map(([name,s])=>({
    name,
    ...s
  }));

  const modeConfig = STAT_MODES[currentMode];
  let htmlOutput = "";

  function formatIP(outs){
    return Math.floor(outs/3) + "." + (outs%3);
  }

  function getTopPlayers(stat){

    let list = [...players];

    if(stat.minAB){
      list = list.filter(p=>p.atBats >= stat.minAB);
    }

    if(stat.minIP){
      list = list.filter(p=>p.ip >= stat.minIP * 3);
    }

    list = list.map(p=>{

      let value = 0;

      switch(stat.key){

        case "avg":
          value = p.atBats>0 ? p.hits/p.atBats : 0;
          break;

        case "obp":
          value = (p.hits + p.walks + p.hbp) /
                  ((p.atBats + p.walks + p.hbp) || 1);
          break;

        case "slg":
          const totalBases =
            p.hits +
            p.doubles +
            (2*p.triples) +
            (3*p.hr);
          value = p.atBats>0 ? totalBases/p.atBats : 0;
          break;

        case "ops":
          const obp =
            (p.hits + p.walks + p.hbp) /
            ((p.atBats + p.walks + p.hbp) || 1);

          const tb =
            p.hits +
            p.doubles +
            (2*p.triples) +
            (3*p.hr);

          const slg = p.atBats>0 ? tb/p.atBats : 0;

          value = obp + slg;
          break;

        case "whip":
          value = p.ip>0 ?
            (p.hitsAllowed + p.walksAllowed)/(p.ip/3)
            : 0;
          break;

        case "era":
          value = p.ip>0 ?
            (p.er * 9)/(p.ip/3)
            : 0;
          break;

        case "kbb":
          value = p.walksAllowed>0 ?
            p.ks/p.walksAllowed
            : p.ks;
          break;

        case "xbh":
          value = p.doubles + p.triples + p.hr;
          break;

        case "bf":
          value = p.battersFaced;
          break;

        case "ip":
          value = p.ip;
          break;

        default:
          value = p[stat.key] || 0;
      }

      return {...p, statValue:value};

    });

    list.sort((a,b)=>b.statValue - a.statValue);

    return list.slice(0,10);
  }

  [...modeConfig.hitting, ...modeConfig.pitching]
    .forEach(stat=>{

      const topList = getTopPlayers(stat);

      htmlOutput += renderList(
        `Top 10 ${stat.label}`,
        topList,
        p=>{

          if(stat.key==="ip"){
            return formatIP(p.ip);
          }

          if(stat.key==="era" || stat.key==="whip"){
            return p.statValue.toFixed(2);
          }

          if(stat.type==="rate"){
            return p.statValue.toFixed(3);
          }

          if(stat.key==="bf"){
            return `${p.battersFaced} (${p.pitches})`;
          }

          return p.statValue;
          
        },
        stat.key
      );

    });

  document.getElementById("leadersContainer").innerHTML = htmlOutput;
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