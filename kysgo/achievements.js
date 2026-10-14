// Achievements: checked against your lifetime stats after every match. The coins are paid by the server once per
// account (supabase.sql cs_achieve); offline play keeps them in this browser.
export const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'First Blood', desc: 'Get your first kill', pay: 100, test: (s) => s.k >= 1 },
  { id: 'k_500', name: 'Body Count', desc: '500 kills', pay: 600, test: (s) => s.k >= 500 },
  { id: 'k_2000', name: 'Walking War Crime', desc: '2,000 kills', pay: 1500, test: (s) => s.k >= 2000 },
  { id: 'hs_100', name: 'Dome Doctor', desc: '100 headshots', pay: 400, test: (s) => s.hs >= 100 },
  { id: 'knife_10', name: 'Stabby McStabface', desc: '10 knife kills', pay: 400, test: (s) => (s.knife || 0) >= 10 },
  { id: 'ace', name: 'ACE', desc: 'Kill the whole enemy team in one round', pay: 500, test: (s) => (s.ace || 0) >= 1 },
  { id: 'clutch', name: 'Clutch or Kick', desc: 'Win a round as the last one standing with 2+ kills', pay: 400, test: (s) => (s.clutch || 0) >= 1 },
  { id: 'win_10', name: 'Getting the Hang of It', desc: 'Win 10 matches', pay: 300, test: (s) => s.wins >= 10 },
  { id: 'win_100', name: 'Touch Grass Never', desc: 'Win 100 matches', pay: 1200, test: (s) => s.wins >= 100 },
  { id: 'mvp_25', name: 'Main Character', desc: '25 round MVPs', pay: 400, test: (s) => s.mvp >= 25 },
  { id: 'zed_10', name: 'Zombie Janitor', desc: 'Reach wave 10 in Zombies', pay: 500, test: (s) => (s.zedWave || 0) >= 10 },
  { id: 'arms_win', name: 'Gun Collector', desc: 'Win an Arms Race', pay: 300, test: (s) => (s.armsWin || 0) >= 1 },
  { id: 'dm_win', name: 'Spawn Camper', desc: 'Win a Deathmatch', pay: 200, test: (s) => (s.dmWin || 0) >= 1 },
  { id: 'kz_done', name: 'Parkour!', desc: 'Finish the Climb course', pay: 300, test: (s) => (s.kz || 0) >= 1 },
  { id: 'retake_5', name: 'Retake Merchant', desc: 'Win 5 Retakes matches', pay: 250, test: (s) => (s.retakeWins || 0) >= 5 },
  { id: 'ranked_5', name: 'Placed', desc: 'Finish your 5 ranked placement matches', pay: 300, test: (s) => (s.ranked || 0) >= 5 },
];
export const LOGIN_PAY = [100, 150, 200, 250, 300, 400, 750];
