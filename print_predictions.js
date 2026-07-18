const fs = require('fs');

const data = JSON.parse(fs.readFileSync('dump_data.json', 'utf8'));

// Get top 7 users
const topUsers = data.users.slice(0, 7);
console.log("Top 7 Users:");
topUsers.forEach((u, idx) => {
  console.log(`${idx + 1}. ${u.displayName} (${u.totalPoints} pts) [ID: ${u.id}]`);
});

// Let's create a map of match predictions
// matchId -> userId -> prediction
const matchPredsByMatch = {};
data.matchPredictions.forEach(p => {
  if (!matchPredsByMatch[p.matchId]) {
    matchPredsByMatch[p.matchId] = {};
  }
  matchPredsByMatch[p.matchId][p.userId] = p;
});

// Let's create a map of bonus predictions
// userId -> answers
const bonusPredsByUser = {};
data.bonusPredictions.forEach(p => {
  bonusPredsByUser[p.userId] = p.answers || {};
});

console.log("\n=== REMAINING MATCHES PREDICTIONS ===");
data.matches.forEach(m => {
  console.log(`\nMatch: ${m.homeTeam} vs ${m.awayTeam} (${m.roundName}) [ID: ${m.id}]`);
  topUsers.forEach(u => {
    const pred = matchPredsByMatch[m.id] ? matchPredsByMatch[m.id][u.id] : null;
    if (pred) {
      console.log(`- ${u.displayName}: ${pred.predictedHomeScore} - ${pred.predictedAwayScore} (Qualifies: ${pred.qualifier})`);
    } else {
      console.log(`- ${u.displayName}: NO PREDICTION`);
    }
  });
});

console.log("\n=== OPEN BONUS PREDICTIONS ===");
data.openBonuses.forEach(b => {
  console.log(`\nBonus: "${b.question}" (${b.points} pts) [ID: ${b.id}]`);
  topUsers.forEach(u => {
    const answers = bonusPredsByUser[u.id] || {};
    const ans = answers[b.id];
    console.log(`- ${u.displayName}: ${ans !== undefined ? ans : 'NO PREDICTION'}`);
  });
});
