-- Counter-Strife accounts for Supabase (free tier). Paste this whole file into Supabase -> SQL Editor -> Run, once.
-- Everything that changes coins or items runs in the functions below (server-side dice, daily earning cap);
-- players can only READ their own profile/items and the public market. Generated from skins.js: re-run after
-- the crates change (it is safe to run again).

create table if not exists cs_profiles (id uuid primary key references auth.users on delete cascade, name text, coins int not null default 500 check (coins >= 0),
  xp int not null default 0, equipped jsonb not null default '{}'::jsonb, stats jsonb not null default '{}'::jsonb, earn_day int not null default 0,
  earned_today int not null default 0, created timestamptz default now());
create table if not exists cs_catalog (def text primary key, crate text not null, tier int not null, kind text not null);
create table if not exists cs_crates (id text primary key, price int not null);
create table if not exists cs_pass (tier int primary key, def text not null references cs_catalog);
alter table cs_profiles add column if not exists pass_claimed int[] not null default '{}';
alter table cs_profiles add column if not exists rr int not null default 0;            -- ranked: Rank Rating
alter table cs_profiles add column if not exists ranked_n int not null default 0;      -- ranked matches played (first 5 = placements)
alter table cs_profiles add column if not exists ranked_w int not null default 0;
alter table cs_profiles add column if not exists ranked_best int not null default 0;   -- best rank reached (rank-up rewards are paid once each)
alter table cs_profiles add column if not exists ranked_last timestamptz;
create table if not exists cs_items (uid text primary key, owner uuid not null references auth.users on delete cascade, def text not null references cs_catalog,
  float real not null, st boolean not null default false, seed int not null, kills int not null default 0, created timestamptz default now());
create table if not exists cs_listings (id bigserial primary key, uid text unique not null references cs_items on delete cascade, seller uuid not null,
  seller_name text, def text, float real, st boolean, seed int, price int not null check (price between 1 and 1000000), created timestamptz default now());

alter table cs_profiles enable row level security; alter table cs_items enable row level security; alter table cs_listings enable row level security;
alter table cs_catalog enable row level security; alter table cs_crates enable row level security; alter table cs_pass enable row level security;
drop policy if exists cs_ps on cs_pass; create policy cs_ps on cs_pass for select using (true);
drop policy if exists cs_own_profile on cs_profiles; create policy cs_own_profile on cs_profiles for select using (auth.uid() = id);
drop policy if exists cs_own_items on cs_items; create policy cs_own_items on cs_items for select using (auth.uid() = owner);
drop policy if exists cs_market on cs_listings; create policy cs_market on cs_listings for select using (true);
drop policy if exists cs_cat on cs_catalog; create policy cs_cat on cs_catalog for select using (true);
drop policy if exists cs_cr on cs_crates; create policy cs_cr on cs_crates for select using (true);

insert into cs_crates (id, price) values ('sand',250),('toilet',250),('nuke',300),('dust2',250),('neon',275),('farm',300),('ocean',325),('gamer',250),('space',275),('jungle',300),('winter',325),('candy',250),('military',275),('gas',300),('retro',325),('spooky',250),('royal',275),('toxic',300),('office',325),('fastfood',250),('beach',275),('metal',300),('dino',325),('clown',250),('brainrot',275),('agents',350) on conflict (id) do update set price = excluded.price;
insert into cs_catalog (def, crate, tier, kind) values
('sand:bizon:Sand Dune','sand',0,'skin'),
('sand:sawedoff:Night Ops','sand',0,'skin'),
('sand:dualies:Forest Floor','sand',0,'skin'),
('sand:deagle:Safety Orange','sand',0,'skin'),
('sand:p90:Urban Grid','sand',0,'skin'),
('sand:xm1014:Blue Steel','sand',0,'skin'),
('sand:famas:Tiger Tooth','sand',1,'skin'),
('sand:p90:Hex Core','sand',1,'skin'),
('sand:m4a4:Circuit Board','sand',1,'skin'),
('sand:awp:Red Laminate','sand',1,'skin'),
('sand:ak47:Damascus','sand',1,'skin'),
('sand:g3sg1:Neon Revolt','sand',2,'skin'),
('sand:mp7:Galaxy Brain','sand',2,'skin'),
('sand:p90:Hellfire','sand',2,'skin'),
('sand:fiveseven:Asii-Not-Mov','sand',3,'skin'),
('sand:mac10:Wyvern Lore','sand',3,'skin'),
('sand:dualies:Fire Serpent-ish','sand',3,'skin'),
('sand:k_bayonet:Vanilla','sand',4,'knife'),
('sand:k_bayonet:Fade','sand',4,'knife'),
('sand:k_bayonet:Doppler','sand',4,'knife'),
('sand:k_bayonet:Tiger Tooth','sand',4,'knife'),
('sand:k_bayonet:Crimson Web','sand',4,'knife'),
('sand:k_bayonet:Marble Fade','sand',4,'knife'),
('sand:k_karambit:Vanilla','sand',4,'knife'),
('sand:k_karambit:Fade','sand',4,'knife'),
('sand:k_karambit:Doppler','sand',4,'knife'),
('sand:k_karambit:Tiger Tooth','sand',4,'knife'),
('sand:k_karambit:Crimson Web','sand',4,'knife'),
('sand:k_karambit:Marble Fade','sand',4,'knife'),
('sand:k_butterfly:Vanilla','sand',4,'knife'),
('sand:k_butterfly:Fade','sand',4,'knife'),
('sand:k_butterfly:Doppler','sand',4,'knife'),
('sand:k_butterfly:Tiger Tooth','sand',4,'knife'),
('sand:k_butterfly:Crimson Web','sand',4,'knife'),
('sand:k_butterfly:Marble Fade','sand',4,'knife'),
('sand:ak47:Nuclear Swamp Ass','sand',6,'skin'),
('toilet:famas:Skidmark','toilet',0,'skin'),
('toilet:sawedoff:Fart Cloud','toilet',0,'skin'),
('toilet:ssg08:Tighty Whities','toilet',0,'skin'),
('toilet:bizon:Granny Panties','toilet',0,'skin'),
('toilet:dualies:Gas Station Sushi','toilet',0,'skin'),
('toilet:g3sg1:Diarrhea Fade','toilet',1,'skin'),
('toilet:bizon:BRRRRT','toilet',1,'skin'),
('toilet:xm1014:Hot Dog Water','toilet',1,'skin'),
('toilet:fiveseven:Pee Yellow','toilet',1,'skin'),
('toilet:fiveseven:Poop Emoji Party','toilet',2,'skin'),
('toilet:ump:Mom''s Spaghetti','toilet',2,'skin'),
('toilet:cz75:Thicc Boi','toilet',2,'skin'),
('toilet:ump:Dong Doppler','toilet',3,'skin'),
('toilet:mac10:Golden Shower','toilet',3,'skin'),
('toilet:k_hotdog:Vanilla','toilet',5,'knife'),
('toilet:k_hotdog:Fade','toilet',5,'knife'),
('toilet:k_hotdog:Doppler','toilet',5,'knife'),
('toilet:k_hotdog:Tiger Tooth','toilet',5,'knife'),
('toilet:k_hotdog:Crimson Web','toilet',5,'knife'),
('toilet:k_hotdog:Marble Fade','toilet',5,'knife'),
('toilet:k_dildo:Vanilla','toilet',5,'knife'),
('toilet:k_dildo:Fade','toilet',5,'knife'),
('toilet:k_dildo:Doppler','toilet',5,'knife'),
('toilet:k_dildo:Tiger Tooth','toilet',5,'knife'),
('toilet:k_dildo:Crimson Web','toilet',5,'knife'),
('toilet:k_dildo:Marble Fade','toilet',5,'knife'),
('toilet:k_plunger:Vanilla','toilet',5,'knife'),
('toilet:k_plunger:Fade','toilet',5,'knife'),
('toilet:k_plunger:Doppler','toilet',5,'knife'),
('toilet:k_plunger:Tiger Tooth','toilet',5,'knife'),
('toilet:k_plunger:Crimson Web','toilet',5,'knife'),
('toilet:k_plunger:Marble Fade','toilet',5,'knife'),
('toilet:k_chicken:Vanilla','toilet',5,'knife'),
('toilet:k_chicken:Fade','toilet',5,'knife'),
('toilet:k_chicken:Doppler','toilet',5,'knife'),
('toilet:k_chicken:Tiger Tooth','toilet',5,'knife'),
('toilet:k_chicken:Crimson Web','toilet',5,'knife'),
('toilet:k_chicken:Marble Fade','toilet',5,'knife'),
('toilet:deagle:Finger Gun','toilet',5,'skin'),
('toilet:m4a4:Radioactive Shart','toilet',6,'skin'),
('nuke:usp:Glow Lawn','nuke',0,'skin'),
('nuke:r8:Hazmat','nuke',0,'skin'),
('nuke:mac10:Picket Fence','nuke',0,'skin'),
('nuke:r8:Fallout Fade','nuke',1,'skin'),
('nuke:tec9:Duck & Cover','nuke',1,'skin'),
('nuke:nova:Half-Life Hex','nuke',2,'skin'),
('nuke:p2000:Mushroom Cloud','nuke',2,'skin'),
('nuke:ak47:Chernobyl Sunset','nuke',3,'skin'),
('nuke:k_baguette:Vanilla','nuke',5,'knife'),
('nuke:k_baguette:Fade','nuke',5,'knife'),
('nuke:k_baguette:Doppler','nuke',5,'knife'),
('nuke:k_baguette:Tiger Tooth','nuke',5,'knife'),
('nuke:k_baguette:Crimson Web','nuke',5,'knife'),
('nuke:k_baguette:Marble Fade','nuke',5,'knife'),
('nuke:k_fish:Vanilla','nuke',5,'knife'),
('nuke:k_fish:Fade','nuke',5,'knife'),
('nuke:k_fish:Doppler','nuke',5,'knife'),
('nuke:k_fish:Tiger Tooth','nuke',5,'knife'),
('nuke:k_fish:Crimson Web','nuke',5,'knife'),
('nuke:k_fish:Marble Fade','nuke',5,'knife'),
('nuke:k_banana:Vanilla','nuke',5,'knife'),
('nuke:k_banana:Fade','nuke',5,'knife'),
('nuke:k_banana:Doppler','nuke',5,'knife'),
('nuke:k_banana:Tiger Tooth','nuke',5,'knife'),
('nuke:k_banana:Crimson Web','nuke',5,'knife'),
('nuke:k_banana:Marble Fade','nuke',5,'knife'),
('nuke:awp:Chernobyl Nutsack','nuke',6,'skin'),
('dust2:deagle:Dune Buggy','dust2',0,'skin'),
('dust2:p250:Goat Herder','dust2',0,'skin'),
('dust2:ssg08:Courtyard','dust2',0,'skin'),
('dust2:bizon:Compound Wall','dust2',0,'skin'),
('dust2:mp5:Dialysis Beige','dust2',0,'skin'),
('dust2:nova:VHS Tape','dust2',1,'skin'),
('dust2:scar20:Cave Painting','dust2',1,'skin'),
('dust2:ump:Long A','dust2',1,'skin'),
('dust2:awp:Mid Doors','dust2',1,'skin'),
('dust2:m4a1s:Hide & Seek','dust2',2,'skin'),
('dust2:sg553:Last Known Address','dust2',2,'skin'),
('dust2:usp:Satellite Dish','dust2',2,'skin'),
('dust2:ak47:Navy Night','dust2',3,'skin'),
('dust2:p90:Hiding Spot','dust2',3,'skin'),
('dust2:deagle:Most Wanted','dust2',4,'skin'),
('dust2:k_bayonet:Vanilla','dust2',4,'knife'),
('dust2:k_bayonet:Desert Heat','dust2',4,'knife'),
('dust2:k_bayonet:Closet Dark','dust2',4,'knife'),
('dust2:k_flip:Vanilla','dust2',4,'knife'),
('dust2:k_flip:Desert Heat','dust2',4,'knife'),
('dust2:k_flip:Closet Dark','dust2',4,'knife'),
('dust2:k_chicken:Desert Heat','dust2',5,'knife'),
('dust2:k_chicken:Closet Dark','dust2',5,'knife'),
('dust2:deagle:Sand In My Crack','dust2',6,'skin'),
('neon:awp:Glowstick','neon',0,'skin'),
('neon:mp9:Rave Leftovers','neon',0,'skin'),
('neon:ump:Club Bathroom','neon',0,'skin'),
('neon:dualies:Laser Tag','neon',0,'skin'),
('neon:nova:Arcade Carpet','neon',0,'skin'),
('neon:fiveseven:Synthwave','neon',1,'skin'),
('neon:cz75:Pixel Burn','neon',1,'skin'),
('neon:scar20:VHS Glitch','neon',1,'skin'),
('neon:m249:Night Drive','neon',1,'skin'),
('neon:bizon:Cyber Shrimp','neon',2,'skin'),
('neon:usp:Overclocked','neon',2,'skin'),
('neon:sawedoff:Retina Damage','neon',2,'skin'),
('neon:p90:Neon Genesis','neon',3,'skin'),
('neon:mac10:Afterparty','neon',3,'skin'),
('neon:ak47:Blacklight Poster','neon',4,'skin'),
('neon:k_karambit:Vanilla','neon',4,'knife'),
('neon:k_karambit:Electric Fade','neon',4,'knife'),
('neon:k_karambit:Static','neon',4,'knife'),
('neon:k_butterfly:Vanilla','neon',4,'knife'),
('neon:k_butterfly:Electric Fade','neon',4,'knife'),
('neon:k_butterfly:Static','neon',4,'knife'),
('neon:k_dildo:Electric Fade','neon',5,'knife'),
('neon:k_dildo:Static','neon',5,'knife'),
('neon:m4a1s:Rave Boner','neon',6,'skin'),
('farm:mag7:Hay Bale','farm',0,'skin'),
('farm:xm1014:Pig Pen','farm',0,'skin'),
('farm:g3sg1:Muddy Boots','farm',0,'skin'),
('farm:ak47:Red Barn','farm',0,'skin'),
('farm:bizon:Corn Field','farm',0,'skin'),
('farm:aug:Tractor Pull','farm',1,'skin'),
('farm:mp5:Moo Point','farm',1,'skin'),
('farm:nova:Chicken Coop','farm',1,'skin'),
('farm:deagle:Scarecrow','farm',1,'skin'),
('farm:tec9:Hen Party','farm',2,'skin'),
('farm:r8:County Fair','farm',2,'skin'),
('farm:p2000:Prize Pumpkin','farm',2,'skin'),
('farm:m4a1s:Cow Tipper','farm',3,'skin'),
('farm:m4a4:Golden Egg','farm',3,'skin'),
('farm:p90:Farmers Only','farm',4,'skin'),
('farm:k_gut:Vanilla','farm',4,'knife'),
('farm:k_gut:Butter Churn','farm',4,'knife'),
('farm:k_gut:Manure Glaze','farm',4,'knife'),
('farm:k_hunts:Vanilla','farm',4,'knife'),
('farm:k_hunts:Butter Churn','farm',4,'knife'),
('farm:k_hunts:Manure Glaze','farm',4,'knife'),
('farm:k_chicken:Butter Churn','farm',5,'knife'),
('farm:k_chicken:Manure Glaze','farm',5,'knife'),
('farm:usp:Glowing Cow Pie','farm',6,'skin'),
('ocean:r8:Tide Pool','ocean',0,'skin'),
('ocean:m4a4:Kelp Forest','ocean',0,'skin'),
('ocean:p90:Shipwreck','ocean',0,'skin'),
('ocean:ump:Barnacle','ocean',0,'skin'),
('ocean:negev:Sea Foam','ocean',0,'skin'),
('ocean:xm1014:Riptide','ocean',1,'skin'),
('ocean:m249:Anglerfish','ocean',1,'skin'),
('ocean:usp:Coral Bleach','ocean',1,'skin'),
('ocean:awp:Jellyfish','ocean',1,'skin'),
('ocean:sg553:Kraken Ink','ocean',2,'skin'),
('ocean:p90:Abyssal','ocean',2,'skin'),
('ocean:mag7:Moby Dick','ocean',2,'skin'),
('ocean:m4a4:Davy Jones','ocean',3,'skin'),
('ocean:deagle:Mermaid Scales','ocean',3,'skin'),
('ocean:deagle:Poseidon','ocean',4,'skin'),
('ocean:k_bayonet:Vanilla','ocean',4,'knife'),
('ocean:k_bayonet:Low Tide','ocean',4,'knife'),
('ocean:k_bayonet:Ink Cloud','ocean',4,'knife'),
('ocean:k_karambit:Vanilla','ocean',4,'knife'),
('ocean:k_karambit:Low Tide','ocean',4,'knife'),
('ocean:k_karambit:Ink Cloud','ocean',4,'knife'),
('ocean:k_fish:Low Tide','ocean',5,'knife'),
('ocean:k_fish:Ink Cloud','ocean',5,'knife'),
('ocean:glock:Bioluminescent Booty','ocean',6,'skin'),
('gamer:g3sg1:RGB Keyboard','gamer',0,'skin'),
('gamer:scar20:Cheeto Dust','gamer',0,'skin'),
('gamer:awp:Rage Quit','gamer',0,'skin'),
('gamer:p2000:Mountain Dew','gamer',0,'skin'),
('gamer:galil:Lag Spike','gamer',0,'skin'),
('gamer:cz75:Ping 999','gamer',1,'skin'),
('gamer:sg553:Ranked Anxiety','gamer',1,'skin'),
('gamer:xm1014:Smurf Account','gamer',1,'skin'),
('gamer:mag7:Tryhard','gamer',1,'skin'),
('gamer:nova:Sweatband','gamer',2,'skin'),
('gamer:galil:Clutch or Kick','gamer',2,'skin'),
('gamer:p250:Headset Hair','gamer',2,'skin'),
('gamer:p90:Diamond Hands','gamer',3,'skin'),
('gamer:m4a1s:Uninstalled','gamer',3,'skin'),
('gamer:ak47:Main Character','gamer',4,'skin'),
('gamer:k_flip:Vanilla','gamer',4,'knife'),
('gamer:k_flip:Gamer Fuel','gamer',4,'knife'),
('gamer:k_flip:Touch Grass','gamer',4,'knife'),
('gamer:k_butterfly:Vanilla','gamer',4,'knife'),
('gamer:k_butterfly:Gamer Fuel','gamer',4,'knife'),
('gamer:k_butterfly:Touch Grass','gamer',4,'knife'),
('gamer:k_banana:Gamer Fuel','gamer',5,'knife'),
('gamer:k_banana:Touch Grass','gamer',5,'knife'),
('gamer:p90:RGB Hemorrhoids','gamer',6,'skin'),
('space:m249:Moon Dust','space',0,'skin'),
('space:fiveseven:Space Junk','space',0,'skin'),
('space:nova:Launch Pad','space',0,'skin'),
('space:ak47:Zero G','space',0,'skin'),
('space:sg553:Freeze Dried','space',0,'skin'),
('space:ssg08:Nebula','space',1,'skin'),
('space:usp:Asteroid Belt','space',1,'skin'),
('space:dualies:Red Planet','space',1,'skin'),
('space:r8:Black Hole','space',1,'skin'),
('space:fiveseven:Supernova','space',2,'skin'),
('space:ssg08:Event Horizon','space',2,'skin'),
('space:m249:Alien Probe','space',2,'skin'),
('space:m4a1s:Big Bang','space',3,'skin'),
('space:p90:Light Year','space',3,'skin'),
('space:p90:Cosmic Brain','space',4,'skin'),
('space:k_karambit:Vanilla','space',4,'knife'),
('space:k_karambit:Star Fade','space',4,'knife'),
('space:k_karambit:Dark Matter','space',4,'knife'),
('space:k_gut:Vanilla','space',4,'knife'),
('space:k_gut:Star Fade','space',4,'knife'),
('space:k_gut:Dark Matter','space',4,'knife'),
('space:k_dildo:Star Fade','space',5,'knife'),
('space:k_dildo:Dark Matter','space',5,'knife'),
('space:ak47:Uranus Glow','space',6,'skin'),
('jungle:mac10:Leaf Litter','jungle',0,'skin'),
('jungle:ump:Swamp Gas','jungle',0,'skin'),
('jungle:usp:Monkey Business','jungle',0,'skin'),
('jungle:p90:Vine Swing','jungle',0,'skin'),
('jungle:awp:Mosquito Bite','jungle',0,'skin'),
('jungle:sawedoff:Python','jungle',1,'skin'),
('jungle:deagle:Rainforest','jungle',1,'skin'),
('jungle:m249:Poison Dart','jungle',1,'skin'),
('jungle:ssg08:Temple Run','jungle',1,'skin'),
('jungle:aug:Jaguar','jungle',2,'skin'),
('jungle:dualies:Lost Idol','jungle',2,'skin'),
('jungle:fiveseven:Golden Temple','jungle',2,'skin'),
('jungle:m4a4:Apex Predator','jungle',3,'skin'),
('jungle:mac10:Canopy','jungle',3,'skin'),
('jungle:m4a1s:El Dorado','jungle',4,'skin'),
('jungle:k_hunts:Vanilla','jungle',4,'knife'),
('jungle:k_hunts:Jungle Fade','jungle',4,'knife'),
('jungle:k_hunts:Shade','jungle',4,'knife'),
('jungle:k_bayonet:Vanilla','jungle',4,'knife'),
('jungle:k_bayonet:Jungle Fade','jungle',4,'knife'),
('jungle:k_bayonet:Shade','jungle',4,'knife'),
('jungle:k_banana:Jungle Fade','jungle',5,'knife'),
('jungle:k_banana:Shade','jungle',5,'knife'),
('jungle:m4a4:Monkey Fling Neon','jungle',6,'skin'),
('winter:scar20:Snowplow','winter',0,'skin'),
('winter:mag7:Slush','winter',0,'skin'),
('winter:xm1014:Ice Fishing','winter',0,'skin'),
('winter:usp:Sleet','winter',0,'skin'),
('winter:g3sg1:Igloo','winter',0,'skin'),
('winter:deagle:Frost Bite','winter',1,'skin'),
('winter:bizon:Avalanche','winter',1,'skin'),
('winter:p250:Polar Vortex','winter',1,'skin'),
('winter:mag7:Yeti','winter',1,'skin'),
('winter:xm1014:Blizzard','winter',2,'skin'),
('winter:mac10:Black Ice','winter',2,'skin'),
('winter:famas:Northern Lights','winter',2,'skin'),
('winter:ssg08:Absolute Zero','winter',3,'skin'),
('winter:m4a4:Frozen Over','winter',3,'skin'),
('winter:ak47:Ice Queen','winter',4,'skin'),
('winter:k_flip:Vanilla','winter',4,'knife'),
('winter:k_flip:Glacier','winter',4,'knife'),
('winter:k_flip:Polar Night','winter',4,'knife'),
('winter:k_karambit:Vanilla','winter',4,'knife'),
('winter:k_karambit:Glacier','winter',4,'knife'),
('winter:k_karambit:Polar Night','winter',4,'knife'),
('winter:k_fish:Glacier','winter',5,'knife'),
('winter:k_fish:Polar Night','winter',5,'knife'),
('winter:awp:Yellow Snow Reactor','winter',6,'skin'),
('candy:negev:Bubblegum','candy',0,'skin'),
('candy:sg553:Cotton Candy','candy',0,'skin'),
('candy:p2000:Gummy Bear','candy',0,'skin'),
('candy:galil:Rock Candy','candy',0,'skin'),
('candy:dualies:Sprinkles','candy',0,'skin'),
('candy:awp:Jawbreaker','candy',1,'skin'),
('candy:negev:Sour Patch','candy',1,'skin'),
('candy:mag7:Candy Cane','candy',1,'skin'),
('candy:fiveseven:Jelly Bean','candy',1,'skin'),
('candy:cz75:Sugar Crash','candy',2,'skin'),
('candy:xm1014:Rotten Tooth','candy',2,'skin'),
('candy:deagle:Gingerbread','candy',2,'skin'),
('candy:m4a1s:Diabetes','candy',3,'skin'),
('candy:deagle:Lollipop','candy',3,'skin'),
('candy:p90:Willy''s Factory','candy',4,'skin'),
('candy:k_butterfly:Vanilla','candy',4,'knife'),
('candy:k_butterfly:Candy Fade','candy',4,'knife'),
('candy:k_butterfly:Licorice','candy',4,'knife'),
('candy:k_gut:Vanilla','candy',4,'knife'),
('candy:k_gut:Candy Fade','candy',4,'knife'),
('candy:k_gut:Licorice','candy',4,'knife'),
('candy:k_hotdog:Candy Fade','candy',5,'knife'),
('candy:k_hotdog:Licorice','candy',5,'knife'),
('candy:deagle:Sugar Shits','candy',6,'skin'),
('military:mp9:Olive Drab','military',0,'skin'),
('military:usp:MRE','military',0,'skin'),
('military:m249:Boot Camp','military',0,'skin'),
('military:mp5:Sandbag','military',0,'skin'),
('military:fiveseven:Field Jacket','military',0,'skin'),
('military:mag7:Ammo Crate','military',1,'skin'),
('military:ssg08:Dog Tags','military',1,'skin'),
('military:tec9:Night Vision','military',1,'skin'),
('military:sg553:Kevlar','military',1,'skin'),
('military:ssg08:Drill Sergeant','military',2,'skin'),
('military:famas:Desert Storm','military',2,'skin'),
('military:galil:Purple Heart','military',2,'skin'),
('military:m4a4:Five Star','military',3,'skin'),
('military:glock:Classified Intel','military',3,'skin'),
('military:m4a1s:Medal of Honor','military',4,'skin'),
('military:k_bayonet:Vanilla','military',4,'knife'),
('military:k_bayonet:Gunmetal','military',4,'knife'),
('military:k_bayonet:Blackout','military',4,'knife'),
('military:k_hunts:Vanilla','military',4,'knife'),
('military:k_hunts:Gunmetal','military',4,'knife'),
('military:k_hunts:Blackout','military',4,'knife'),
('military:k_plunger:Gunmetal','military',5,'knife'),
('military:k_plunger:Blackout','military',5,'knife'),
('military:m4a1s:Night Vision Wedgie','military',6,'skin'),
('gas:glock:Slushie Brain','gas',0,'skin'),
('gas:deagle:Scratch Ticket','gas',0,'skin'),
('gas:tec9:Beef Jerky','gas',0,'skin'),
('gas:usp:Pump 4','gas',0,'skin'),
('gas:mp9:Air Freshener','gas',0,'skin'),
('gas:mac10:Roller Grill','gas',1,'skin'),
('gas:dualies:Lottery Loser','gas',1,'skin'),
('gas:famas:Truck Stop','gas',1,'skin'),
('gas:nova:Energy Shot','gas',1,'skin'),
('gas:sawedoff:Lot Lizard','gas',2,'skin'),
('gas:g3sg1:Midnight Burrito','gas',2,'skin'),
('gas:deagle:Gas Leak','gas',2,'skin'),
('gas:ssg08:Premium Unleaded','gas',3,'skin'),
('gas:p90:Bathroom Key','gas',3,'skin'),
('gas:m4a4:Ultimate Shift','gas',4,'skin'),
('gas:k_flip:Vanilla','gas',4,'knife'),
('gas:k_flip:Fuel Fade','gas',4,'knife'),
('gas:k_flip:Oil Slick','gas',4,'knife'),
('gas:k_gut:Vanilla','gas',4,'knife'),
('gas:k_gut:Fuel Fade','gas',4,'knife'),
('gas:k_gut:Oil Slick','gas',4,'knife'),
('gas:k_hotdog:Fuel Fade','gas',5,'knife'),
('gas:k_hotdog:Oil Slick','gas',5,'knife'),
('gas:usp:Truck Stop Toilet Glow','gas',6,'skin'),
('retro:galil:Shag Carpet','retro',0,'skin'),
('retro:ump:Lava Lamp','retro',0,'skin'),
('retro:negev:Cassette','retro',0,'skin'),
('retro:m249:Floppy Disk','retro',0,'skin'),
('retro:mac10:Wood Panel','retro',0,'skin'),
('retro:scar20:Disco Ball','retro',1,'skin'),
('retro:r8:Mixtape','retro',1,'skin'),
('retro:cz75:Mullet','retro',1,'skin'),
('retro:tec9:Dial-Up','retro',1,'skin'),
('retro:deagle:Roller Rink','retro',2,'skin'),
('retro:tec9:Boombox','retro',2,'skin'),
('retro:m4a1s:Tamagotchi','retro',2,'skin'),
('retro:usp:Y2K Panic','retro',3,'skin'),
('retro:ak47:Blockbuster','retro',3,'skin'),
('retro:ssg08:Totally Radical','retro',4,'skin'),
('retro:k_karambit:Vanilla','retro',4,'knife'),
('retro:k_karambit:Sunset Fade','retro',4,'knife'),
('retro:k_karambit:Rewind','retro',4,'knife'),
('retro:k_bayonet:Vanilla','retro',4,'knife'),
('retro:k_bayonet:Sunset Fade','retro',4,'knife'),
('retro:k_bayonet:Rewind','retro',4,'knife'),
('retro:k_baguette:Sunset Fade','retro',5,'knife'),
('retro:k_baguette:Rewind','retro',5,'knife'),
('retro:glock:Lava Lamp Lube','retro',6,'skin'),
('spooky:mp7:Pumpkin Spice','spooky',0,'skin'),
('spooky:negev:Cobweb','spooky',0,'skin'),
('spooky:tec9:Graveyard Shift','spooky',0,'skin'),
('spooky:mac10:Candy Corn','spooky',0,'skin'),
('spooky:p90:Bat Cave','spooky',0,'skin'),
('spooky:negev:Ectoplasm','spooky',1,'skin'),
('spooky:bizon:Haunted Doll','spooky',1,'skin'),
('spooky:m4a4:Witch Brew','spooky',1,'skin'),
('spooky:sg553:Full Moon','spooky',1,'skin'),
('spooky:awp:Possessed','spooky',2,'skin'),
('spooky:mp7:Poltergeist','spooky',2,'skin'),
('spooky:mac10:Bone Daddy','spooky',2,'skin'),
('spooky:awp:Grim Reaper','spooky',3,'skin'),
('spooky:m4a4:Sleep Paralysis','spooky',3,'skin'),
('spooky:m4a1s:The Final Boss','spooky',4,'skin'),
('spooky:k_gut:Vanilla','spooky',4,'knife'),
('spooky:k_gut:Ghost Fade','spooky',4,'knife'),
('spooky:k_gut:Midnight','spooky',4,'knife'),
('spooky:k_butterfly:Vanilla','spooky',4,'knife'),
('spooky:k_butterfly:Ghost Fade','spooky',4,'knife'),
('spooky:k_butterfly:Midnight','spooky',4,'knife'),
('spooky:k_banana:Ghost Fade','spooky',5,'knife'),
('spooky:k_banana:Midnight','spooky',5,'knife'),
('spooky:p90:Ecto-Snot','spooky',6,'skin'),
('royal:usp:Crumpet','royal',0,'skin'),
('royal:aug:Corgi','royal',0,'skin'),
('royal:galil:Tea Stain','royal',0,'skin'),
('royal:scar20:Velvet Rope','royal',0,'skin'),
('royal:bizon:Fancy Napkin','royal',0,'skin'),
('royal:mp9:Crown Jewels','royal',1,'skin'),
('royal:famas:Monocle','royal',1,'skin'),
('royal:deagle:Ballroom','royal',1,'skin'),
('royal:bizon:Royal Flush','royal',1,'skin'),
('royal:mag7:Throne Room','royal',2,'skin'),
('royal:xm1014:Off With Their Heads','royal',2,'skin'),
('royal:aug:Gold Leaf','royal',2,'skin'),
('royal:ssg08:Divine Right','royal',3,'skin'),
('royal:deagle:Peasant Tax','royal',3,'skin'),
('royal:m4a4:King Of Kings','royal',4,'skin'),
('royal:k_butterfly:Vanilla','royal',4,'knife'),
('royal:k_butterfly:Royal Fade','royal',4,'knife'),
('royal:k_butterfly:Tower Dark','royal',4,'knife'),
('royal:k_flip:Vanilla','royal',4,'knife'),
('royal:k_flip:Royal Fade','royal',4,'knife'),
('royal:k_flip:Tower Dark','royal',4,'knife'),
('royal:k_baguette:Royal Fade','royal',5,'knife'),
('royal:k_baguette:Tower Dark','royal',5,'knife'),
('royal:ak47:Royal Flush (Literally)','royal',6,'skin'),
('toxic:famas:Sludge','toxic',0,'skin'),
('toxic:p2000:Barrel Drum','toxic',0,'skin'),
('toxic:deagle:Hazard Tape','toxic',0,'skin'),
('toxic:m249:Sewer Rat','toxic',0,'skin'),
('toxic:sawedoff:Ooze','toxic',0,'skin'),
('toxic:glock:Mutagen','toxic',1,'skin'),
('toxic:awp:Chem Spill','toxic',1,'skin'),
('toxic:m4a4:Radioactive','toxic',1,'skin'),
('toxic:tec9:Glow Worm','toxic',1,'skin'),
('toxic:r8:Acid Rain','toxic',2,'skin'),
('toxic:m4a4:Biohazard','toxic',2,'skin'),
('toxic:mp7:Swamp Thing','toxic',2,'skin'),
('toxic:usp:Meltdown','toxic',3,'skin'),
('toxic:glock:Patient Zero','toxic',3,'skin'),
('toxic:ssg08:Toxic Avenger','toxic',4,'skin'),
('toxic:k_hunts:Vanilla','toxic',4,'knife'),
('toxic:k_hunts:Slime Fade','toxic',4,'knife'),
('toxic:k_hunts:Fume','toxic',4,'knife'),
('toxic:k_karambit:Vanilla','toxic',4,'knife'),
('toxic:k_karambit:Slime Fade','toxic',4,'knife'),
('toxic:k_karambit:Fume','toxic',4,'knife'),
('toxic:k_plunger:Slime Fade','toxic',5,'knife'),
('toxic:k_plunger:Fume','toxic',5,'knife'),
('toxic:m4a4:Glowing Booger','toxic',6,'skin'),
('office:mp5:Cubicle','office',0,'skin'),
('office:r8:Stapler','office',0,'skin'),
('office:m4a4:Casual Friday','office',0,'skin'),
('office:deagle:Fax Machine','office',0,'skin'),
('office:galil:TPS Report','office',0,'skin'),
('office:galil:Coffee Stain','office',1,'skin'),
('office:p250:Team Building','office',1,'skin'),
('office:mp9:Reply All','office',1,'skin'),
('office:m4a1s:Micromanager','office',1,'skin'),
('office:g3sg1:Synergy','office',2,'skin'),
('office:scar20:Quarterly Loss','office',2,'skin'),
('office:sg553:Golden Parachute','office',2,'skin'),
('office:awp:Hostile Takeover','office',3,'skin'),
('office:ssg08:Unpaid Overtime','office',3,'skin'),
('office:usp:CEO Bonus','office',4,'skin'),
('office:k_flip:Vanilla','office',4,'knife'),
('office:k_flip:Spreadsheet Fade','office',4,'knife'),
('office:k_flip:Burnout','office',4,'knife'),
('office:k_bayonet:Vanilla','office',4,'knife'),
('office:k_bayonet:Spreadsheet Fade','office',4,'knife'),
('office:k_bayonet:Burnout','office',4,'knife'),
('office:k_chicken:Spreadsheet Fade','office',5,'knife'),
('office:k_chicken:Burnout','office',5,'knife'),
('office:awp:Printer Ink Diarrhea','office',6,'skin'),
('fastfood:p2000:Ketchup Packet','fastfood',0,'skin'),
('fastfood:nova:Soggy Fries','fastfood',0,'skin'),
('fastfood:r8:Grease Trap','fastfood',0,'skin'),
('fastfood:g3sg1:Kids Meal','fastfood',0,'skin'),
('fastfood:m4a4:Napkin Dispenser','fastfood',0,'skin'),
('fastfood:mp7:Secret Sauce','fastfood',1,'skin'),
('fastfood:mp9:Milkshake Machine','fastfood',1,'skin'),
('fastfood:aug:Drive-Thru','fastfood',1,'skin'),
('fastfood:p90:Value Menu','fastfood',1,'skin'),
('fastfood:m249:Triple Stack','fastfood',2,'skin'),
('fastfood:fiveseven:Heart Attack','fastfood',2,'skin'),
('fastfood:ump:Golden Arches-ish','fastfood',2,'skin'),
('fastfood:mac10:Supersized','fastfood',3,'skin'),
('fastfood:ak47:Ice Cream Machine Broke','fastfood',3,'skin'),
('fastfood:m4a4:Employee Of The Month','fastfood',4,'skin'),
('fastfood:k_gut:Vanilla','fastfood',4,'knife'),
('fastfood:k_gut:Grease Fade','fastfood',4,'knife'),
('fastfood:k_gut:Fryer Oil','fastfood',4,'knife'),
('fastfood:k_flip:Vanilla','fastfood',4,'knife'),
('fastfood:k_flip:Grease Fade','fastfood',4,'knife'),
('fastfood:k_flip:Fryer Oil','fastfood',4,'knife'),
('fastfood:k_hotdog:Grease Fade','fastfood',5,'knife'),
('fastfood:k_hotdog:Fryer Oil','fastfood',5,'knife'),
('fastfood:deagle:Radioactive Nugget','fastfood',6,'skin'),
('beach:ak47:Sandcastle','beach',0,'skin'),
('beach:galil:Sunburn','beach',0,'skin'),
('beach:m4a1s:Flip Flop','beach',0,'skin'),
('beach:xm1014:Beach Towel','beach',0,'skin'),
('beach:aug:Seagull Theft','beach',0,'skin'),
('beach:usp:Tiki Bar','beach',1,'skin'),
('beach:sawedoff:Coconut','beach',1,'skin'),
('beach:mp7:Surf''s Up','beach',1,'skin'),
('beach:p250:Jet Ski','beach',1,'skin'),
('beach:mac10:Lifeguard','beach',2,'skin'),
('beach:ump:Tan Lines','beach',2,'skin'),
('beach:g3sg1:Boardwalk','beach',2,'skin'),
('beach:usp:Shark Week','beach',3,'skin'),
('beach:awp:Paradise','beach',3,'skin'),
('beach:ssg08:Spring Breaker','beach',4,'skin'),
('beach:k_butterfly:Vanilla','beach',4,'knife'),
('beach:k_butterfly:Sunset Fade','beach',4,'knife'),
('beach:k_butterfly:Riptide','beach',4,'knife'),
('beach:k_hunts:Vanilla','beach',4,'knife'),
('beach:k_hunts:Sunset Fade','beach',4,'knife'),
('beach:k_hunts:Riptide','beach',4,'knife'),
('beach:k_fish:Sunset Fade','beach',5,'knife'),
('beach:k_fish:Riptide','beach',5,'knife'),
('beach:m4a1s:Jellyfish Pee','beach',6,'skin'),
('metal:ump:Mosh Pit','metal',0,'skin'),
('metal:awp:Leather Jacket','metal',0,'skin'),
('metal:mac10:Spiked Collar','metal',0,'skin'),
('metal:cz75:Power Chord','metal',0,'skin'),
('metal:g3sg1:Roadie','metal',0,'skin'),
('metal:famas:Headbanger','metal',1,'skin'),
('metal:m4a4:Guitar Solo','metal',1,'skin'),
('metal:ssg08:Amp Feedback','metal',1,'skin'),
('metal:galil:Pyro','metal',1,'skin'),
('metal:scar20:Black Sabbath-ish','metal',2,'skin'),
('metal:mag7:Iron Maiden-ish','metal',2,'skin'),
('metal:ump:Encore','metal',2,'skin'),
('metal:awp:Face Melter','metal',3,'skin'),
('metal:usp:Wall Of Death','metal',3,'skin'),
('metal:usp:Rock God','metal',4,'skin'),
('metal:k_karambit:Vanilla','metal',4,'knife'),
('metal:k_karambit:Chrome','metal',4,'knife'),
('metal:k_karambit:Blackened','metal',4,'knife'),
('metal:k_hunts:Vanilla','metal',4,'knife'),
('metal:k_hunts:Chrome','metal',4,'knife'),
('metal:k_hunts:Blackened','metal',4,'knife'),
('metal:k_dildo:Chrome','metal',5,'knife'),
('metal:k_dildo:Blackened','metal',5,'knife'),
('metal:usp:Face Melter Deluxe','metal',6,'skin'),
('dino:dualies:Fossil','dino',0,'skin'),
('dino:tec9:Amber','dino',0,'skin'),
('dino:aug:Tar Pit','dino',0,'skin'),
('dino:awp:Egg Shell','dino',0,'skin'),
('dino:glock:Ferns','dino',0,'skin'),
('dino:mp5:Raptor Claw','dino',1,'skin'),
('dino:scar20:Meteor Strike','dino',1,'skin'),
('dino:ump:Volcano','dino',1,'skin'),
('dino:mp7:Pterodactyl','dino',1,'skin'),
('dino:negev:T-Rex Arms','dino',2,'skin'),
('dino:sg553:Extinction Event','dino',2,'skin'),
('dino:scar20:Bone Dry','dino',2,'skin'),
('dino:mac10:Apex Fossil','dino',3,'skin'),
('dino:glock:Jurassic Spark','dino',3,'skin'),
('dino:awp:Dino Nuggets','dino',4,'skin'),
('dino:k_gut:Vanilla','dino',4,'knife'),
('dino:k_gut:Amber Fade','dino',4,'knife'),
('dino:k_gut:Tar','dino',4,'knife'),
('dino:k_bayonet:Vanilla','dino',4,'knife'),
('dino:k_bayonet:Amber Fade','dino',4,'knife'),
('dino:k_bayonet:Tar','dino',4,'knife'),
('dino:k_chicken:Amber Fade','dino',5,'knife'),
('dino:k_chicken:Tar','dino',5,'knife'),
('dino:glock:Raptor Dookie Plasma','dino',6,'skin'),
('clown:m4a1s:Big Shoes','clown',0,'skin'),
('clown:mp9:Balloon Animal','clown',0,'skin'),
('clown:mp5:Seltzer','clown',0,'skin'),
('clown:sawedoff:Juggler','clown',0,'skin'),
('clown:dualies:Rubber Nose','clown',0,'skin'),
('clown:p2000:Face Paint','clown',1,'skin'),
('clown:cz75:Pie In The Face','clown',1,'skin'),
('clown:g3sg1:Unicycle','clown',1,'skin'),
('clown:dualies:Circus Peanut','clown',1,'skin'),
('clown:mp9:Clown Car','clown',2,'skin'),
('clown:usp:Creepy Smile','clown',2,'skin'),
('clown:xm1014:Big Top','clown',2,'skin'),
('clown:glock:Honk Honk','clown',3,'skin'),
('clown:mac10:Ringmaster','clown',3,'skin'),
('clown:mac10:Certified Clown','clown',4,'skin'),
('clown:k_butterfly:Vanilla','clown',4,'knife'),
('clown:k_butterfly:Confetti Fade','clown',4,'knife'),
('clown:k_butterfly:Greasepaint','clown',4,'knife'),
('clown:k_karambit:Vanilla','clown',4,'knife'),
('clown:k_karambit:Confetti Fade','clown',4,'knife'),
('clown:k_karambit:Greasepaint','clown',4,'knife'),
('clown:k_dildo:Confetti Fade','clown',5,'knife'),
('clown:k_dildo:Greasepaint','clown',5,'knife'),
('clown:p90:Clown Fart Rave','clown',6,'skin'),
('brainrot:bizon:Skibidi Flush','brainrot',0,'skin'),
('brainrot:sawedoff:NPC Energy','brainrot',0,'skin'),
('brainrot:ssg08:Fanum Tax','brainrot',0,'skin'),
('brainrot:fiveseven:Mewing Streak','brainrot',0,'skin'),
('brainrot:cz75:Only In Ohio','brainrot',0,'skin'),
('brainrot:ak47:Aura Farmer','brainrot',1,'skin'),
('brainrot:mp5:Delulu','brainrot',1,'skin'),
('brainrot:p90:Mogged','brainrot',1,'skin'),
('brainrot:famas:Cap Detector','brainrot',1,'skin'),
('brainrot:usp:Rizz Lord','brainrot',2,'skin'),
('brainrot:r8:Sigma Grindset','brainrot',2,'skin'),
('brainrot:p2000:Gyatt Damn','brainrot',2,'skin'),
('brainrot:deagle:Final Boss Of Ohio','brainrot',3,'skin'),
('brainrot:ak47:Negative Aura','brainrot',3,'skin'),
('brainrot:usp:Brainrot Supreme','brainrot',4,'skin'),
('brainrot:k_karambit:Vanilla','brainrot',4,'knife'),
('brainrot:k_karambit:Bussin','brainrot',4,'knife'),
('brainrot:k_karambit:Lowkey Cooked','brainrot',4,'knife'),
('brainrot:k_butterfly:Vanilla','brainrot',4,'knife'),
('brainrot:k_butterfly:Bussin','brainrot',4,'knife'),
('brainrot:k_butterfly:Lowkey Cooked','brainrot',4,'knife'),
('brainrot:k_banana:Bussin','brainrot',5,'knife'),
('brainrot:k_banana:Lowkey Cooked','brainrot',5,'knife'),
('brainrot:ak47:Infinite Aura Overload','brainrot',6,'skin'),
('agents:a_t_ops','agents',2,'agent'),
('agents:a_ct_swat','agents',2,'agent'),
('agents:a_t_speedo','agents',3,'agent'),
('agents:a_ct_tighty','agents',3,'agent'),
('agents:a_t_hotdog','agents',4,'agent'),
('agents:a_ct_poo','agents',5,'agent'),
('agents:a_t_grandma','agents',3,'agent'),
('agents:a_ct_pigeon','agents',4,'agent'),
('agents:a_t_banana','agents',2,'agent'),
('agents:a_ct_mime','agents',2,'agent'),
('agents:a_t_reactor','agents',6,'agent'),
('agents:a_ct_plasma','agents',6,'agent'),
('agents:a_t_lava','agents',6,'agent'),
('agents:a_t_log','agents',6,'agent'),
('agents:a_t_florida','agents',3,'agent'),
('agents:a_t_gamer','agents',2,'agent'),
('agents:a_ct_chef','agents',3,'agent'),
('agents:a_ct_karen','agents',4,'agent'),
('agents:a_ct_cone','agents',2,'agent'),
('agents:a_ct_void','agents',6,'agent'),
('agents:e_dance','agents',1,'emote'),
('agents:e_dab','agents',1,'emote'),
('agents:e_cry','agents',1,'emote'),
('agents:e_flex','agents',2,'emote'),
('agents:e_tpose','agents',2,'emote'),
('agents:e_floss','agents',2,'emote'),
('agents:e_chicken','agents',3,'emote'),
('agents:e_worm','agents',4,'emote'),
('agents:e_fart','agents',5,'emote'),
('agents:e_twerk','agents',5,'emote'),
('agents:e_griddy','agents',3,'emote'),
('agents:e_headbang','agents',1,'emote'),
('agents:e_heli','agents',2,'emote'),
('agents:e_clap','agents',1,'emote'),
('agents:e_zombie','agents',2,'emote'),
('agents:e_tbag','agents',4,'emote'),
('agents:e_sit','agents',3,'emote'),
('agents:e_lmao','agents',4,'emote'),
('pass1:glock:Participation Trophy','pass',0,'skin'),
('pass2:usp:Grass Toucher','pass',0,'skin'),
('pass3:e_dance','pass',1,'emote'),
('pass4:ak47:Mom''s Basement','pass',0,'skin'),
('pass5:a_t_banana','pass',2,'agent'),
('pass6:e_dab','pass',1,'emote'),
('pass7:m4a4:Gamer Fuel','pass',0,'skin'),
('pass8:awp:Sweaty Palms','pass',0,'skin'),
('pass9:e_cry','pass',1,'emote'),
('pass10:a_ct_mime','pass',2,'agent'),
('pass11:deagle:No Life','pass',1,'skin'),
('pass12:e_flex','pass',2,'emote'),
('pass13:mp9:Touch Grass Pro','pass',1,'skin'),
('pass14:mac10:Hall of Shame','pass',1,'skin'),
('pass15:a_t_speedo','pass',3,'agent'),
('pass16:p90:Certified Clown','pass',1,'skin'),
('pass17:galil:Rainbow Road Rage','pass',1,'skin'),
('pass18:e_tpose','pass',2,'emote'),
('pass19:famas:Participation Trophy','pass',1,'skin'),
('pass20:a_ct_tighty','pass',3,'agent'),
('pass21:e_floss','pass',2,'emote'),
('pass22:nova:Grass Toucher','pass',2,'skin'),
('pass23:ump:Mom''s Basement','pass',2,'skin'),
('pass24:e_chicken','pass',3,'emote'),
('pass25:k_hotdog:Ballpark Special','pass',5,'knife'),
('pass26:ssg08:Gamer Fuel','pass',2,'skin'),
('pass27:e_worm','pass',4,'emote'),
('pass28:p250:Sweaty Palms','pass',2,'skin'),
('pass29:m4a1s:No Life','pass',2,'skin'),
('pass30:a_t_grandma','pass',3,'agent'),
('pass31:sg553:Touch Grass Pro','pass',3,'skin'),
('pass32:aug:Hall of Shame','pass',3,'skin'),
('pass33:e_fart','pass',5,'emote'),
('pass34:tec9:Certified Clown','pass',3,'skin'),
('pass35:a_ct_pigeon','pass',4,'agent'),
('pass36:e_twerk','pass',5,'emote'),
('pass37:fiveseven:Rainbow Road Rage','pass',3,'skin'),
('pass38:glock:Participation Trophy','pass',3,'skin'),
('pass39:usp:Grass Toucher','pass',3,'skin'),
('pass40:a_t_hotdog','pass',4,'agent'),
('pass41:ak47:Mom''s Basement','pass',4,'skin'),
('pass42:m4a4:Gamer Fuel','pass',4,'skin'),
('pass43:awp:Sweaty Palms','pass',4,'skin'),
('pass44:deagle:No Life','pass',4,'skin'),
('pass45:a_ct_poo','pass',5,'agent'),
('pass46:mp9:Touch Grass Pro','pass',4,'skin'),
('pass47:mac10:Hall of Shame','pass',4,'skin'),
('pass48:p90:Certified Clown','pass',4,'skin'),
('pass49:galil:Rainbow Road Rage','pass',4,'skin'),
('pass50:k_dildo:Gold Plated','pass',5,'knife'),
('pass:e_wave','pass',0,'emote'),
('pass:e_salute','pass',0,'emote'),
('pass:e_griddy','pass',3,'emote'),
('pass:e_headbang','pass',1,'emote'),
('pass:e_heli','pass',2,'emote'),
('pass:e_clap','pass',1,'emote'),
('pass:e_zombie','pass',2,'emote'),
('pass:e_tbag','pass',4,'emote'),
('pass:e_sit','pass',3,'emote'),
('pass:e_lmao','pass',4,'emote')
on conflict (def) do update set crate = excluded.crate, tier = excluded.tier, kind = excluded.kind;
insert into cs_pass (tier, def) values (1,'pass1:glock:Participation Trophy'),(2,'pass2:usp:Grass Toucher'),(3,'pass3:e_dance'),(4,'pass4:ak47:Mom''s Basement'),(5,'pass5:a_t_banana'),(6,'pass6:e_dab'),(7,'pass7:m4a4:Gamer Fuel'),(8,'pass8:awp:Sweaty Palms'),(9,'pass9:e_cry'),(10,'pass10:a_ct_mime'),(11,'pass11:deagle:No Life'),(12,'pass12:e_flex'),(13,'pass13:mp9:Touch Grass Pro'),(14,'pass14:mac10:Hall of Shame'),(15,'pass15:a_t_speedo'),(16,'pass16:p90:Certified Clown'),(17,'pass17:galil:Rainbow Road Rage'),(18,'pass18:e_tpose'),(19,'pass19:famas:Participation Trophy'),(20,'pass20:a_ct_tighty'),(21,'pass21:e_floss'),(22,'pass22:nova:Grass Toucher'),(23,'pass23:ump:Mom''s Basement'),(24,'pass24:e_chicken'),(25,'pass25:k_hotdog:Ballpark Special'),(26,'pass26:ssg08:Gamer Fuel'),(27,'pass27:e_worm'),(28,'pass28:p250:Sweaty Palms'),(29,'pass29:m4a1s:No Life'),(30,'pass30:a_t_grandma'),(31,'pass31:sg553:Touch Grass Pro'),(32,'pass32:aug:Hall of Shame'),(33,'pass33:e_fart'),(34,'pass34:tec9:Certified Clown'),(35,'pass35:a_ct_pigeon'),(36,'pass36:e_twerk'),(37,'pass37:fiveseven:Rainbow Road Rage'),(38,'pass38:glock:Participation Trophy'),(39,'pass39:usp:Grass Toucher'),(40,'pass40:a_t_hotdog'),(41,'pass41:ak47:Mom''s Basement'),(42,'pass42:m4a4:Gamer Fuel'),(43,'pass43:awp:Sweaty Palms'),(44,'pass44:deagle:No Life'),(45,'pass45:a_ct_poo'),(46,'pass46:mp9:Touch Grass Pro'),(47,'pass47:mac10:Hall of Shame'),(48,'pass48:p90:Certified Clown'),(49,'pass49:galil:Rainbow Road Rage'),(50,'pass50:k_dildo:Gold Plated') on conflict (tier) do update set def = excluded.def;

create or replace function cs_profile(p_name text) returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); nm text;
begin
  if me is null then raise exception 'sign in first'; end if;
  -- the name: what the game sent, else the name given at sign-up, else Player
  select coalesce(nullif(trim(p_name), ''), nullif(trim(u.raw_user_meta_data->>'name'), ''), 'Player') into nm from auth.users u where u.id = me;
  nm := left(regexp_replace(coalesce(nm, 'Player'), '[<>#]', '', 'g'), 20); if length(nm) < 2 then nm := 'Player'; end if;
  insert into cs_profiles (id, name, tag, dep_code) values (me, nm, 1000 + floor(random() * 9000), upper(substr(md5(random()::text || me::text), 1, 8))) on conflict (id) do nothing;
  update cs_profiles set name = nm where id = me and coalesce(name, '') in ('', 'Player') and nm <> 'Player';
  -- the owner's account: admin, and its starting 10,000,000 coins (once)
  if cs_is_admin() and not exists (select 1 from cs_log where action = 'admin_seed') then
    update cs_profiles set coins = greatest(coins, 10000000) where id = me;
    insert into cs_log (actor, action, detail) values (me, 'admin_seed', '{}'::jsonb);
  end if;
  -- once: the owner's inventory reset to one of everything (re-run any time from the Admin tab)
  if cs_is_admin() and not exists (select 1 from cs_log where action = 'admin_collection') then perform cs_admin_collection(); end if;
  if cs_is_admin() then perform cs_admin_fill(); end if;
  perform cs_settle_due();   -- pay out any finished prize-pool day
  if cs_is_admin() and not exists (select 1 from cs_log where action = 'admin_max') then perform cs_admin_max(); end if;
  return (select json_build_object('name', p.name, 'username', p.username, 'tag', p.tag, 'dep', p.dep_code, 'admin', cs_is_admin(), 'guns', coalesce(p.guns, '{}'::jsonb) - '_day', 'coins', p.coins, 'xp', p.xp, 'equipped', p.equipped, 'stats', p.stats, 'pass', p.pass_claimed,
    'rank', json_build_object('rr', p.rr, 'n', p.ranked_n, 'w', p.ranked_w, 'best', p.ranked_best),
    'items', coalesce((select json_agg(json_build_object('uid', i.uid, 'def', i.def, 'float', i.float, 'st', i.st, 'seed', i.seed, 'kills', i.kills,
      'created', i.created, 'grade', i.grade, 'acquired', i.acquired, 'owners', i.owners, 'nft', i.nft_asset, 'mint', (select q.status from cs_nft_queue q where q.item_uid = i.uid), 'listed', (select l.price from cs_listings l where l.uid = i.uid)) order by i.created desc) from cs_items i where i.owner = me), '[]'::json),
    'wallet', (select json_build_object('address', w.address, 'box', w.box) from cs_wallets w where w.uid = me),
    'nftcfg', (select json_build_object('rpc', c.rpc, 'trees', c.trees, 'canopy', c.canopy, 'on', c."on") from cs_nft_cfg c where c.id = 1))
    from cs_profiles p where p.id = me);
end $$;

create or replace function cs_reward(p_kind text, p_coins int, p_xp int, p_detail jsonb) returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); d int := floor(extract(epoch from now()) / 86400); cap int; give int; gx int; lv0 int; lv1 int; r cs_profiles%rowtype;
begin
  if me is null then raise exception 'sign in first'; end if;
  cap := case p_kind when 'match' then 600 when 'quest' then 500 when 'daily' then 100 else 0 end;
  select * into r from cs_profiles where id = me for update;
  if r.earn_day <> d then r.earned_today := 0; end if;
  give := greatest(0, least(coalesce(p_coins, 0), cap, 4000 - r.earned_today));
  gx := greatest(0, least(coalesce(p_xp, 0), 2000));
  lv0 := floor(sqrt(r.xp / 100.0)) + 1; lv1 := floor(sqrt((r.xp + gx) / 100.0)) + 1;
  update cs_profiles set coins = coins + give + 200 * (lv1 - lv0), xp = xp + gx, earn_day = d, earned_today = r.earned_today + give where id = me
    returning coins, xp into r.coins, r.xp;
  if p_kind = 'match' then perform cs_daily_stat(me, p_detail); end if;   -- today's prize-pool ranking
  return json_build_object('coins', r.coins, 'xp', r.xp, 'granted', give);
end $$;

create or replace function cs_open_crate(p_crate text) returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); pr int; c int; roll float8; tot float8; acc float8 := 0; t int; pick text; k text; u text; fl real; isst boolean; sd int;
begin
  if me is null then raise exception 'sign in first'; end if;
  select price into pr from cs_crates where id = p_crate; if pr is null then raise exception 'no such crate'; end if;
  update cs_profiles set coins = coins - pr where id = me and coins >= pr returning coins into c;
  if c is null then raise exception 'Not enough coins'; end if;
  select sum((array[69.8,20,6.5,2.5,0.8,0.2,0.2]::float8[])[s.tier + 1]) into tot from (select distinct tier from cs_catalog where crate = p_crate) s;
  roll := random() * tot;
  for t in select distinct tier from cs_catalog where crate = p_crate order by tier loop
    acc := acc + (array[69.8,20,6.5,2.5,0.8,0.2,0.2]::float8[])[t + 1];
    exit when roll < acc;
  end loop;
  select def, kind into pick, k from cs_catalog where crate = p_crate and tier = t order by random() limit 1;
  u := md5(random()::text || clock_timestamp()::text || me::text);
  fl := case when k = 'agent' then 0 else random() end; isst := k <> 'agent' and random() < 0.1; sd := floor(random() * 1000);
  insert into cs_items (uid, owner, def, float, st, seed) values (u, me, pick, fl, isst, sd);
  return json_build_object('uid', u, 'def', pick, 'float', fl, 'st', isst, 'seed', sd, 'coins', c);
end $$;

create or replace function cs_value(p_def text, p_float real, p_st boolean) returns int language sql stable set search_path = public as $$
  select round((array[20,60,200,700,2500,6000,6000])[c.tier + 1] * (case when c.kind = 'agent' then 1.5 when c.kind = 'emote' then 0.8 when p_float < 0.07 then 1.5 when p_float < 0.15 then 1.15 when p_float < 0.38 then 1
    when p_float < 0.45 then 0.85 else 0.7 end) * (case when p_st then 2 else 1 end))::int from cs_catalog c where c.def = p_def
$$;

create or replace function cs_sell(p_uid text) returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); it cs_items%rowtype; v int; c int;
begin
  select * into it from cs_items where uid = p_uid and owner = me for update; if it.uid is null then raise exception 'not yours'; end if;
  v := round(cs_value(it.def, it.float, it.st) * 0.8);
  delete from cs_items where uid = p_uid;
  update cs_profiles set coins = coins + v where id = me returning coins into c;
  return json_build_object('coins', c, 'got', v);
end $$;

create or replace function cs_list(p_uid text, p_price int) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); it cs_items%rowtype;
begin
  select * into it from cs_items where uid = p_uid and owner = me; if it.uid is null then raise exception 'not yours'; end if;
  insert into cs_listings (uid, seller, seller_name, def, float, st, seed, price)
    values (it.uid, me, (select name from cs_profiles where id = me), it.def, it.float, it.st, it.seed, p_price);
end $$;

create or replace function cs_unlist(p_uid text) returns void language plpgsql security definer set search_path = public as $$
begin delete from cs_listings where uid = p_uid and seller = auth.uid(); end $$;

create or replace function cs_buy(p_listing bigint) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); l cs_listings%rowtype; c int;
begin
  if me is null then raise exception 'sign in first'; end if;
  select * into l from cs_listings where id = p_listing for update; if l.id is null then raise exception 'already sold'; end if;
  if l.seller = me then raise exception 'that is your own listing'; end if;
  update cs_profiles set coins = coins - l.price where id = me and coins >= l.price returning coins into c;
  if c is null then raise exception 'Not enough coins'; end if;
  update cs_profiles set coins = coins + floor(l.price * 0.95) where id = l.seller;   -- 5% market fee (a coin sink)
  delete from cs_listings where id = l.id;
  update cs_items set owner = me where uid = l.uid;
end $$;

-- the free battle pass: one claim per level reached, checked against the XP stored on the server
create or replace function cs_claim_pass(p_tier int) returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r cs_profiles%rowtype; d text; k text; u text; fl real; sd int;
begin
  if me is null then raise exception 'sign in first'; end if;
  select * into r from cs_profiles where id = me for update;
  if floor(sqrt(r.xp / 100.0)) + 1 < p_tier then raise exception 'reach level % first', p_tier; end if;
  if p_tier = any(r.pass_claimed) then raise exception 'already claimed'; end if;
  select p.def, c.kind into d, k from cs_pass p join cs_catalog c on c.def = p.def where p.tier = p_tier; if d is null then raise exception 'no such tier'; end if;
  u := md5(random()::text || clock_timestamp()::text || me::text); fl := case when k in ('agent', 'emote') then 0 else random() * 0.38 end; sd := floor(random() * 1000);
  insert into cs_items (uid, owner, def, float, st, seed) values (u, me, d, fl, false, sd);
  update cs_profiles set pass_claimed = array_append(pass_claimed, p_tier) where id = me;
  return json_build_object('uid', u, 'def', d, 'float', fl, 'st', false, 'seed', sd);
end $$;

create or replace function cs_equip(p_equipped jsonb) returns void language plpgsql security definer set search_path = public as $$
begin
  if length(p_equipped::text) > 8000 then raise exception 'too big'; end if;
  update cs_profiles set equipped = p_equipped where id = auth.uid();
end $$;

-- ===== friends, trades, coin gifts, admin =====================================================================
alter table cs_profiles add column if not exists tag int;
alter table cs_profiles add column if not exists dep_code text;
update cs_profiles set dep_code = upper(substr(md5(random()::text || id::text), 1, 8)) where dep_code is null;
create unique index if not exists cs_profiles_dep on cs_profiles (dep_code);
update cs_profiles set tag = 1000 + floor(random() * 9000) where tag is null;
create table if not exists cs_admins (id uuid primary key references auth.users on delete cascade);
create table if not exists cs_friends (a uuid not null references auth.users on delete cascade, b uuid not null references auth.users on delete cascade,
  state text not null default 'pending', created timestamptz default now(), primary key (a, b));
create table if not exists cs_trades (id bigserial primary key, from_id uuid not null references auth.users on delete cascade, to_id uuid not null references auth.users on delete cascade,
  give_items text[] not null default '{}', give_coins int not null default 0 check (give_coins >= 0), want_items text[] not null default '{}', want_coins int not null default 0 check (want_coins >= 0),
  state text not null default 'open', created timestamptz default now());
create table if not exists cs_log (id bigserial primary key, at timestamptz default now(), actor uuid, action text, detail jsonb);
alter table cs_admins enable row level security; alter table cs_friends enable row level security; alter table cs_trades enable row level security; alter table cs_log enable row level security;
drop policy if exists cs_fr on cs_friends; create policy cs_fr on cs_friends for select using (auth.uid() in (a, b));
drop policy if exists cs_tr on cs_trades; create policy cs_tr on cs_trades for select using (auth.uid() in (from_id, to_id));

-- exactly one admin, ever: the owner's address, and only once that address has been confirmed by email
create or replace function cs_is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from auth.users u where u.id = auth.uid() and lower(u.email) = 'aaronsodaro@gmail.com' and u.email_confirmed_at is not null)
$$;
delete from cs_admins where id not in (select id from auth.users where lower(email) = 'aaronsodaro@gmail.com');
-- usernames: unique handles friends add you by (letters, numbers, underscore; 3-16; case doesn't matter)
alter table cs_profiles add column if not exists username text;
create unique index if not exists cs_profiles_username on cs_profiles (lower(username));
create or replace function cs_set_username(p_user text) returns text language plpgsql security definer set search_path = public as $$
declare u text := trim(coalesce(p_user, ''));
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if u !~ '^[A-Za-z0-9_]{3,16}$' then raise exception 'Usernames are 3-16 letters, numbers or _'; end if;
  if exists (select 1 from cs_profiles where lower(username) = lower(u) and id <> auth.uid()) then raise exception 'That username is taken'; end if;
  update cs_profiles set username = u where id = auth.uid();
  return u;
end $$;
create or replace function cs_find(p_handle text) returns uuid language plpgsql stable security definer set search_path = public as $$
declare nm text := split_part(p_handle, '#', 1); tg int; r uuid;
begin
  begin tg := nullif(split_part(p_handle, '#', 2), '')::int; exception when others then tg := null; end;
  if position('#' in p_handle) = 0 then select id into r from cs_profiles where lower(username) = lower(trim(p_handle)); if r is not null then return r; end if; end if;
  select id into r from cs_profiles where lower(name) = lower(trim(nm)) and (tg is null or tag = tg) order by created limit 1;
  if r is null then raise exception 'No player called % (use their username, or Name#1234)', p_handle; end if;
  return r;
end $$;
create or replace function cs_set_name(p_name text) returns void language plpgsql security definer set search_path = public as $$
begin
  if length(trim(coalesce(p_name, ''))) < 2 or p_name ~ '[<>#]' then raise exception 'Names need 2+ characters, no < > #'; end if;
  update cs_profiles set name = left(trim(p_name), 20) where id = auth.uid();
end $$;
create or replace function cs_are_friends(x uuid, y uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from cs_friends where state = 'accepted' and ((a = x and b = y) or (a = y and b = x)))
$$;
create or replace function cs_friend_request(p_handle text) returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t uuid := cs_find(p_handle);
begin
  if t = me then raise exception 'That is you'; end if;
  if exists (select 1 from cs_friends where a = t and b = me and state = 'pending') then
    update cs_friends set state = 'accepted' where a = t and b = me; return 'accepted';
  end if;
  insert into cs_friends (a, b) values (me, t) on conflict do nothing; return 'sent';
end $$;
create or replace function cs_friend_accept(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin update cs_friends set state = 'accepted' where a = p_id and b = auth.uid() and state = 'pending'; end $$;
create or replace function cs_friend_remove(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
begin delete from cs_friends where (a = auth.uid() and b = p_id) or (a = p_id and b = auth.uid()); end $$;
create or replace function cs_friends_list() returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', p.id, 'name', p.name, 'tag', p.tag, 'username', p.username, 'state', f.state, 'incoming', f.b = auth.uid()) order by p.name), '[]'::json)
  from cs_friends f join cs_profiles p on p.id = case when f.a = auth.uid() then f.b else f.a end where auth.uid() in (f.a, f.b)
$$;
create or replace function cs_friend_items(p_id uuid) returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not cs_are_friends(auth.uid(), p_id) then raise exception 'Only friends can see each other''s items'; end if;
  return (select coalesce(json_agg(json_build_object('uid', i.uid, 'def', i.def, 'float', i.float, 'st', i.st, 'seed', i.seed)), '[]'::json) from cs_items i
    where i.owner = p_id and not exists (select 1 from cs_listings l where l.uid = i.uid));
end $$;
create or replace function cs_gift_coins(p_to uuid, p_amount int) returns int language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c int;
begin
  if p_amount is null or p_amount < 1 then raise exception 'Send at least 1 coin'; end if;
  if not cs_are_friends(me, p_to) and not cs_is_admin() then raise exception 'You can only send coins to friends'; end if;
  update cs_profiles set coins = coins - p_amount where id = me and coins >= p_amount returning coins into c;
  if c is null then raise exception 'Not enough coins'; end if;
  update cs_profiles set coins = coins + p_amount where id = p_to;
  insert into cs_log (actor, action, detail) values (me, 'gift', json_build_object('to', p_to, 'coins', p_amount));
  return c;
end $$;
create or replace function cs_trade_offer(p_to uuid, p_give text[], p_give_coins int, p_want text[], p_want_coins int) returns bigint language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); id bigint;
begin
  if not cs_are_friends(me, p_to) then raise exception 'You can only trade with friends'; end if;
  if coalesce(array_length(p_give, 1), 0) + coalesce(array_length(p_want, 1), 0) + coalesce(p_give_coins, 0) + coalesce(p_want_coins, 0) = 0 then raise exception 'Empty trade'; end if;
  if coalesce(array_length(p_give, 1), 0) > 20 or coalesce(array_length(p_want, 1), 0) > 20 then raise exception 'Max 20 items a side'; end if;
  if exists (select 1 from unnest(coalesce(p_give, '{}')) u where not exists (select 1 from cs_items where uid = u and owner = me)) then raise exception 'You don''t own all of those'; end if;
  if exists (select 1 from unnest(coalesce(p_want, '{}')) u where not exists (select 1 from cs_items where uid = u and owner = p_to)) then raise exception 'They don''t own all of those'; end if;
  insert into cs_trades (from_id, to_id, give_items, give_coins, want_items, want_coins) values (me, p_to, coalesce(p_give, '{}'), greatest(0, coalesce(p_give_coins, 0)), coalesce(p_want, '{}'), greatest(0, coalesce(p_want_coins, 0))) returning cs_trades.id into id;
  return id;
end $$;
create or replace function cs_trade_respond(p_id bigint, p_accept boolean) returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); t cs_trades%rowtype; a int; b int;
begin
  select * into t from cs_trades where id = p_id for update;
  if t.id is null or t.state <> 'open' then raise exception 'That trade is no longer open'; end if;
  if me = t.from_id and not p_accept then update cs_trades set state = 'cancelled' where id = p_id; return 'cancelled'; end if;
  if me <> t.to_id then raise exception 'Not your trade'; end if;
  if not p_accept then update cs_trades set state = 'declined' where id = p_id; return 'declined'; end if;
  perform 1 from cs_profiles where id in (t.from_id, t.to_id) order by id for update;
  if exists (select 1 from unnest(t.give_items) u where not exists (select 1 from cs_items where uid = u and owner = t.from_id))
     or exists (select 1 from unnest(t.want_items) u where not exists (select 1 from cs_items where uid = u and owner = t.to_id)) then
    update cs_trades set state = 'failed' where id = p_id; return 'items changed hands since the offer';
  end if;
  select coins into a from cs_profiles where id = t.from_id; select coins into b from cs_profiles where id = t.to_id;
  if a < t.give_coins or b < t.want_coins then update cs_trades set state = 'failed' where id = p_id; return 'not enough coins'; end if;
  delete from cs_listings where uid = any(t.give_items) or uid = any(t.want_items);
  update cs_items set owner = t.to_id where uid = any(t.give_items);
  update cs_items set owner = t.from_id where uid = any(t.want_items);
  update cs_profiles set coins = coins - t.give_coins + t.want_coins where id = t.from_id;
  update cs_profiles set coins = coins + t.give_coins - t.want_coins where id = t.to_id;
  update cs_trades set state = 'done' where id = p_id;
  insert into cs_log (actor, action, detail) values (me, 'trade', json_build_object('id', p_id));
  return 'done';
end $$;
create or replace function cs_trades_list() returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('id', t.id, 'from', t.from_id, 'to', t.to_id, 'from_name', pf.name || '#' || pf.tag, 'to_name', pt.name || '#' || pt.tag,
    'give', (select coalesce(json_agg(json_build_object('uid', i.uid, 'def', i.def, 'float', i.float, 'st', i.st, 'seed', i.seed)), '[]'::json) from cs_items i where i.uid = any(t.give_items)),
    'want', (select coalesce(json_agg(json_build_object('uid', i.uid, 'def', i.def, 'float', i.float, 'st', i.st, 'seed', i.seed)), '[]'::json) from cs_items i where i.uid = any(t.want_items)),
    'give_coins', t.give_coins, 'want_coins', t.want_coins, 'mine', t.from_id = auth.uid()) order by t.created desc), '[]'::json)
  from cs_trades t join cs_profiles pf on pf.id = t.from_id join cs_profiles pt on pt.id = t.to_id where t.state = 'open' and auth.uid() in (t.from_id, t.to_id)
$$;
-- the owner's showroom: wipe the admin's own inventory and give exactly one of every item in the game (FN, StatTrak
-- on guns and knives). Only the admin, only their own account; logged.
create or replace function cs_admin_collection() returns int language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n int;
begin
  if not cs_is_admin() then raise exception 'admin only'; end if;
  delete from cs_items where owner = me;
  insert into cs_items (uid, owner, def, float, st, seed)
    select md5(random()::text || clock_timestamp()::text || c.def), me, c.def, case when c.kind in ('agent', 'emote') then 0 else random() * 0.07 end, c.kind in ('skin', 'knife'), floor(random() * 1000)
    from cs_catalog c;
  get diagnostics n = row_count;
  update cs_profiles set equipped = '{}'::jsonb where id = me;
  insert into cs_log (actor, action, detail) values (me, 'admin_collection', json_build_object('items', n));
  return n;
end $$;
-- the owner's showroom stays complete: on every load, one of each catalog item the admin doesn't currently hold is
-- added (new items appear as soon as the catalog has them; a sold or traded one comes back). Extras are left alone.
create or replace function cs_admin_fill() returns int language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); n int;
begin
  if not cs_is_admin() then raise exception 'admin only'; end if;
  insert into cs_items (uid, owner, def, float, st, seed)
    select md5(random()::text || clock_timestamp()::text || c.def), me, c.def, case when c.kind in ('agent', 'emote') then 0 else random() * 0.07 end, c.kind in ('skin', 'knife'), floor(random() * 1000)
    from cs_catalog c where not exists (select 1 from cs_items i where i.owner = me and i.def = c.def);
  get diagnostics n = row_count;
  if n > 0 then insert into cs_log (actor, action, detail) values (me, 'admin_fill', json_build_object('items', n)); end if;
  return n;
end $$;
-- the owner's account maxed: top player level (every pass tier marked claimed: the collection already holds them) and
-- every gun at Level 10, so every attachment is unlocked. Attachments chosen before are kept.
create or replace function cs_admin_max() returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g jsonb; mx jsonb := jsonb_build_object('glock', jsonb_build_object('xp', 13500), 'usp', jsonb_build_object('xp', 13500), 'p2000', jsonb_build_object('xp', 13500), 'dualies', jsonb_build_object('xp', 13500), 'p250', jsonb_build_object('xp', 13500), 'tec9', jsonb_build_object('xp', 13500), 'fiveseven', jsonb_build_object('xp', 13500), 'cz75', jsonb_build_object('xp', 13500), 'deagle', jsonb_build_object('xp', 13500), 'r8', jsonb_build_object('xp', 13500), 'mac10', jsonb_build_object('xp', 13500), 'mp9', jsonb_build_object('xp', 13500), 'mp7', jsonb_build_object('xp', 13500), 'mp5', jsonb_build_object('xp', 13500), 'ump', jsonb_build_object('xp', 13500), 'p90', jsonb_build_object('xp', 13500), 'bizon', jsonb_build_object('xp', 13500), 'nova', jsonb_build_object('xp', 13500), 'xm1014', jsonb_build_object('xp', 13500), 'sawedoff', jsonb_build_object('xp', 13500), 'mag7', jsonb_build_object('xp', 13500), 'm249', jsonb_build_object('xp', 13500), 'negev', jsonb_build_object('xp', 13500), 'galil', jsonb_build_object('xp', 13500), 'famas', jsonb_build_object('xp', 13500)) || jsonb_build_object('ak47', jsonb_build_object('xp', 13500), 'm4a4', jsonb_build_object('xp', 13500), 'm4a1s', jsonb_build_object('xp', 13500), 'sg553', jsonb_build_object('xp', 13500), 'aug', jsonb_build_object('xp', 13500), 'ssg08', jsonb_build_object('xp', 13500), 'awp', jsonb_build_object('xp', 13500), 'g3sg1', jsonb_build_object('xp', 13500), 'scar20', jsonb_build_object('xp', 13500)); k text;
begin
  if not cs_is_admin() then raise exception 'admin only'; end if;
  select guns into g from cs_profiles where id = me;
  for k in select jsonb_object_keys(mx) loop g := jsonb_set(coalesce(g, '{}'::jsonb), array[k], coalesce(g->k, '{}'::jsonb) || jsonb_build_object('xp', 13500)); end loop;
  update cs_profiles set xp = greatest(xp, 1000000), guns = g, pass_claimed = (select array_agg(t) from generate_series(1, 50) t) where id = me;
  insert into cs_log (actor, action, detail) values (me, 'admin_max', '{}'::jsonb);
end $$;
-- admin (only the owner's confirmed address: see cs_is_admin)
create or replace function cs_admin_find(p_q text) returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not cs_is_admin() then raise exception 'admin only'; end if;
  return (select coalesce(json_agg(json_build_object('id', id, 'name', name, 'tag', tag, 'coins', coins, 'xp', xp)), '[]'::json) from
    (select * from cs_profiles where coalesce(p_q, '') = '' or lower(name) like lower(p_q) || '%' order by name limit 50) s);
end $$;
create or replace function cs_admin_grant(p_id uuid, p_coins int, p_def text, p_count int) returns json language plpgsql security definer set search_path = public as $$
declare k text; n int := 0;
begin
  if not cs_is_admin() then raise exception 'admin only'; end if;
  if coalesce(p_coins, 0) <> 0 then update cs_profiles set coins = greatest(0, coins + p_coins) where id = p_id; end if;
  if p_def is not null and p_def <> '' then
    select kind into k from cs_catalog where def = p_def; if k is null then raise exception 'No such item'; end if;
    for n in 1 .. least(greatest(coalesce(p_count, 1), 1), 100) loop
      insert into cs_items (uid, owner, def, float, st, seed) values (md5(random()::text || clock_timestamp()::text), p_id, p_def, case when k in ('agent', 'emote') then 0 else random() * 0.07 end, k in ('skin', 'knife'), floor(random() * 1000));
    end loop;
  end if;
  insert into cs_log (actor, action, detail) values (auth.uid(), 'admin_grant', json_build_object('to', p_id, 'coins', p_coins, 'def', p_def, 'count', p_count));
  return (select json_build_object('coins', coins) from cs_profiles where id = p_id);
end $$;

revoke all on function cs_is_admin(), cs_find(text), cs_set_name(text), cs_are_friends(uuid, uuid), cs_friend_request(text), cs_friend_accept(uuid), cs_friend_remove(uuid), cs_friends_list(), cs_friend_items(uuid), cs_gift_coins(uuid, int), cs_trade_offer(uuid, text[], int, text[], int), cs_trade_respond(bigint, boolean), cs_trades_list(), cs_admin_find(text), cs_admin_grant(uuid, int, text, int), cs_admin_collection(), cs_admin_max(), cs_set_username(text), cs_claim_pass(int), cs_profile(text), cs_reward(text, int, int, jsonb), cs_open_crate(text), cs_sell(text), cs_list(text, int), cs_unlist(text), cs_buy(bigint), cs_equip(jsonb) from public, anon;
grant execute on function cs_is_admin(), cs_find(text), cs_set_name(text), cs_are_friends(uuid, uuid), cs_friend_request(text), cs_friend_accept(uuid), cs_friend_remove(uuid), cs_friends_list(), cs_friend_items(uuid), cs_gift_coins(uuid, int), cs_trade_offer(uuid, text[], int, text[], int), cs_trade_respond(bigint, boolean), cs_trades_list(), cs_admin_find(text), cs_admin_grant(uuid, int, text, int), cs_admin_collection(), cs_admin_max(), cs_set_username(text), cs_claim_pass(int), cs_profile(text), cs_reward(text, int, int, jsonb), cs_open_crate(text), cs_sell(text), cs_list(text, int), cs_unlist(text), cs_buy(bigint), cs_equip(jsonb) to authenticated;
revoke all on function cs_value(text, real, boolean) from public, anon;
revoke all on function cs_admin_fill() from public, anon, authenticated;   -- runs only inside cs_profile

-- ===== gun levels and attachments ================================================================================
-- XP per gun (damage, kills, round wins with it): capped per match report and per day; attachments unlock by level.
-- Attachments are looks only (optics allow aiming down sights; the Level 10 suppressor only makes the gun quieter).
alter table cs_profiles add column if not exists guns jsonb not null default '{}'::jsonb;
create or replace function cs_gun_level(p_xp int) returns int language sql immutable as $$
  select coalesce((select max(l) from generate_series(1, 10) l where 150 * l * (l - 1) <= coalesce(p_xp, 0)), 1)
$$;
create or replace function cs_att_slot(p_att text) returns text language sql immutable as $$
  select case when p_att in ('iron', 'reddot', 'holo', 'acog') then 'optic' when p_att in ('standard', 'comp', 'flashhider', 'brake', 'shroud', 'suppressor') then 'muzzle'
    when p_att in ('duplex', 'mildot', 'dotret', 'circle', 'chevret', 'hotdog') then 'reticle' else null end
$$;
create or replace function cs_att_lvl(p_att text) returns int language sql immutable as $$
  select case p_att when 'reddot' then 2 when 'holo' then 4 when 'acog' then 6 when 'comp' then 3 when 'flashhider' then 5 when 'brake' then 7 when 'shroud' then 9
    when 'suppressor' then 10 when 'mildot' then 2 when 'dotret' then 4 when 'circle' then 6 when 'chevret' then 8 when 'hotdog' then 9 else 1 end
$$;
create or replace function cs_gun_xp(p_gains jsonb) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g jsonb; k text; v int; tot int := 0; dd text := to_char(now() at time zone 'utc', 'YYYY-MM-DD'); used int;
begin
  if me is null then raise exception 'sign in first'; end if;
  if jsonb_typeof(p_gains) <> 'object' then raise exception 'bad report'; end if;
  select guns into g from cs_profiles where id = me for update;
  if g is null then raise exception 'no profile yet'; end if;
  used := case when g->'_day'->>'d' = dd then coalesce((g->'_day'->>'xp')::int, 0) else 0 end;
  for k, v in select key, greatest(0, least(3000, case when jsonb_typeof(value) = 'number' then floor((value #>> '{}')::numeric)::int else 0 end)) from jsonb_each(p_gains) limit 40 loop
    if k !~ '^[a-z0-9]{2,12}$' or k = '_day' then continue; end if;
    v := least(v, 6000 - tot, 60000 - used - tot);
    if v <= 0 then continue; end if;
    tot := tot + v;
    g := jsonb_set(g, array[k], coalesce(g->k, '{}'::jsonb) || jsonb_build_object('xp', coalesce((g->k->>'xp')::int, 0) + v));
  end loop;
  g := g || jsonb_build_object('_day', jsonb_build_object('d', dd, 'xp', used + tot));
  update cs_profiles set guns = g where id = me;
  return g - '_day';
end $$;
create or replace function cs_gun_equip(p_wid text, p_slot text, p_att text) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); g jsonb;
begin
  if me is null then raise exception 'sign in first'; end if;
  if p_wid !~ '^[a-z0-9]{2,12}$' or cs_att_slot(p_att) is distinct from p_slot then raise exception 'That attachment doesn''t go there'; end if;
  select guns into g from cs_profiles where id = me for update;
  if cs_gun_level((g->p_wid->>'xp')::int) < cs_att_lvl(p_att) then raise exception 'Reach level % with this gun first', cs_att_lvl(p_att); end if;
  g := jsonb_set(g, array[p_wid], coalesce(g->p_wid, '{}'::jsonb) || jsonb_build_object('att', coalesce(g->p_wid->'att', '{}'::jsonb) || jsonb_build_object(p_slot, p_att)));
  update cs_profiles set guns = g where id = me;
  return g - '_day';
end $$;
revoke all on function cs_gun_xp(jsonb), cs_gun_equip(text, text, text) from public, anon;
grant execute on function cs_gun_xp(jsonb), cs_gun_equip(text, text, text) to authenticated;

-- ===== ranked =====================================================================================================
-- Rank Rating per account, worked out here (the game only reports the result): a win +25, a loss -20, both nudged by
-- up to 5 for how you played (kills minus deaths); wins against bot opponents count half; the first 5 matches are
-- placements (double swings). One report per 2.5 minutes. Reaching a rank for the first time pays 300 coins x its
-- number, once; every ranked win pays 50.
create or replace function cs_rank_tier(p_rr int) returns int language sql immutable as $$
  select (count(*) - 1)::int from unnest(array[0, 100, 200, 300, 400, 550, 700, 850, 1000, 1200, 1400]) v where coalesce(p_rr, 0) >= v $$;
create or replace function cs_ranked(p_win boolean, p_draw boolean, p_k int, p_d int, p_vs_bots boolean) returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); r cs_profiles%rowtype; dl int; t int; pay int := 0; i int;
begin
  if me is null then raise exception 'sign in first'; end if;
  select * into r from cs_profiles where id = me for update;
  if r.ranked_last is not null and r.ranked_last > now() - interval '150 seconds' then raise exception 'One ranked result every few minutes'; end if;
  dl := case when p_draw then 0 when p_win then 25 else -20 end + greatest(-5, least(5, coalesce(p_k, 0) - coalesce(p_d, 0)));
  if p_draw then dl := 0; end if;
  if p_win and dl < 10 then dl := 10; end if;                 -- a win always gains
  if not p_win and not p_draw and dl > -8 then dl := -8; end if;  -- a loss always costs a little
  if p_vs_bots and dl > 0 then dl := dl / 2; end if;
  if r.ranked_n < 5 then dl := dl * 2; end if;
  r.rr := greatest(0, r.rr + dl); t := cs_rank_tier(r.rr);
  if t > r.ranked_best then for i in r.ranked_best + 1 .. t loop pay := pay + 300 * i; end loop; end if;
  if p_win then pay := pay + 50; end if;
  update cs_profiles set rr = r.rr, ranked_n = ranked_n + 1, ranked_w = ranked_w + (case when p_win then 1 else 0 end), ranked_best = greatest(ranked_best, t),
    ranked_last = now(), coins = coins + pay where id = me returning coins into r.coins;
  return json_build_object('rr', r.rr, 'delta', dl, 'tier', t, 'up', t > r.ranked_best, 'pay', pay, 'coins', r.coins, 'n', r.ranked_n + 1);
end $$;
revoke all on function cs_ranked(boolean, boolean, int, int, boolean) from public, anon;
grant execute on function cs_ranked(boolean, boolean, int, int, boolean) to authenticated;

-- ===== economy: the house market, sales history, and the daily prize pool ========================================
-- Coins that leave players (case spins, house-market purchases, the 5% player-market fee) go into the day's pool.
-- At 11pm New York time the pool is paid out to that day's players, ranked by one stat that rotates daily
-- (kills, then MVPs, then wins): 1st 50%, 2nd 25%, 3rd 15%, and 10% shared by everyone else who played. Shares
-- nobody qualifies for roll into the next day. Only players with at least one match that day take part.
create table if not exists cs_ai_listings (id bigserial primary key, def text not null references cs_catalog, float real not null, st boolean not null default false,
  seed int not null, price int not null check (price > 0), created timestamptz default now());
create table if not exists cs_sales (id bigserial primary key, def text not null, price int not null, ai boolean not null, at timestamptz default now());
create index if not exists cs_sales_def on cs_sales (def, at);
create table if not exists cs_pool (day date primary key, coins bigint not null default 0, settled boolean not null default false, category text, results jsonb);
create table if not exists cs_daily (day date not null, uid uuid not null references auth.users on delete cascade, kills int not null default 0, mvps int not null default 0,
  wins int not null default 0, matches int not null default 0, primary key (day, uid));
create table if not exists cs_meta (k text primary key, at timestamptz);
alter table cs_ai_listings enable row level security; alter table cs_sales enable row level security; alter table cs_pool enable row level security;
alter table cs_daily enable row level security; alter table cs_meta enable row level security;
drop policy if exists cs_ail on cs_ai_listings; create policy cs_ail on cs_ai_listings for select using (true);
drop policy if exists cs_pl on cs_pool; create policy cs_pl on cs_pool for select using (true);
drop policy if exists cs_dl on cs_daily; create policy cs_dl on cs_daily for select using (auth.uid() = uid);

-- the pool "day" runs 11pm to 11pm New York time (daylight saving handled by the time zone)
create or replace function cs_pool_day(ts timestamptz default now()) returns date language sql stable as $$
  select ((ts at time zone 'America/New_York') + interval '1 hour')::date $$;
create or replace function cs_pool_cat(d date) returns text language sql immutable as $$
  select (array['kills', 'mvps', 'wins'])[(((d - date '2026-10-08') % 3) + 3) % 3 + 1] $$;
create or replace function cs_pool_add(n bigint) returns void language plpgsql security definer set search_path = public as $$
begin
  if n is null or n <= 0 then return; end if;
  insert into cs_pool (day, coins, category) values (cs_pool_day(), n, cs_pool_cat(cs_pool_day()))
    on conflict (day) do update set coins = cs_pool.coins + excluded.coins;
end $$;

-- pay out one finished day (idempotent: a settled day is skipped)
create or replace function cs_settle(d date) returns void language plpgsql security definer set search_path = public as $$
declare p cs_pool%rowtype; cat text := cs_pool_cat(d); r record; n int; rest int; paid bigint := 0; share bigint; res jsonb := '[]'::jsonb; k int := 0; restShare bigint;
begin
  insert into cs_pool (day, coins, category) values (d, 0, cat) on conflict (day) do nothing;
  select * into p from cs_pool where day = d for update;
  if p.settled then return; end if;
  select count(*) into n from cs_daily where day = d and matches > 0;
  rest := greatest(0, n - 3); restShare := case when rest > 0 then floor(p.coins * 0.10 / rest) else 0 end;
  for r in select x.uid, (case cat when 'kills' then x.kills when 'mvps' then x.mvps else x.wins end) as m, coalesce(pr.name, 'Player') as name
           from cs_daily x left join cs_profiles pr on pr.id = x.uid
           where x.day = d and x.matches > 0
           order by (case cat when 'kills' then x.kills when 'mvps' then x.mvps else x.wins end) desc, x.kills + x.mvps + x.wins desc, x.matches, x.uid loop
    k := k + 1;
    share := case when k = 1 and r.m > 0 then floor(p.coins * 0.50) when k = 2 and r.m > 0 then floor(p.coins * 0.25) when k = 3 and r.m > 0 then floor(p.coins * 0.15)
                  when k > 3 then restShare else 0 end;
    if share > 0 then
      update cs_profiles set coins = coins + least(share, 2000000000 - coins) where id = r.uid;
      paid := paid + share;
    end if;
    if k <= 10 or share > 0 then res := res || jsonb_build_object('rank', k, 'name', r.name, 'stat', r.m, 'coins', share, 'uid', r.uid); end if;
  end loop;
  update cs_pool set settled = true, category = cat, results = res where day = d;
  if p.coins - paid > 0 then   -- shares nobody qualified for roll into the next day
    insert into cs_pool (day, coins, category) values (d + 1, p.coins - paid, cs_pool_cat(d + 1))
      on conflict (day) do update set coins = cs_pool.coins + excluded.coins;
  end if;
  insert into cs_log (actor, action, detail) values (null, 'pool_settle', jsonb_build_object('day', d, 'category', cat, 'pool', p.coins, 'paid', paid, 'players', n));
end $$;
-- every finished, unpaid day. Runs from the 11pm schedule (pg_cron, below) and, as a backstop, whenever anyone loads
-- their profile or the market, so a payout is never missed even without the scheduler.
create or replace function cs_settle_due() returns void language plpgsql security definer set search_path = public as $$
declare d date;
begin
  for d in select day from cs_pool where not settled and day < cs_pool_day() order by day loop perform cs_settle(d); end loop;
  for d in select distinct day from cs_daily x where day < cs_pool_day() and not exists (select 1 from cs_pool p where p.day = x.day) loop perform cs_settle(d); end loop;
end $$;
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'cs-pool';
  perform cron.schedule('cs-pool', '1 * * * *', 'select cs_settle_due()');   -- hourly at :01 catches 11pm in both EST and EDT
exception when others then raise notice 'pg_cron not available (%): payouts run when players next load the game', sqlerrm;
end $$;

-- a match's stats count toward today's ranking (capped per match, and at most 40 matches a day count)
create or replace function cs_daily_stat(me uuid, p_detail jsonb) returns void language plpgsql security definer set search_path = public as $$
declare d date := cs_pool_day();
begin
  insert into cs_daily (day, uid) values (d, me) on conflict do nothing;
  -- matches against bots only count half their kills and MVPs (no farming the easy bots for the pool)
  update cs_daily set kills = kills + least(greatest(coalesce((p_detail->>'k')::int, 0), 0), 60) / (case when (p_detail->>'bots')::boolean then 2 else 1 end),
    mvps = mvps + least(greatest(coalesce((p_detail->>'mvp')::int, 0), 0), 16) / (case when (p_detail->>'bots')::boolean then 2 else 1 end),
    wins = wins + (case when (p_detail->>'win')::boolean then 1 else 0 end), matches = matches + 1
    where day = d and uid = me and matches < 40;
end $$;

-- ---- the house market: always stocked, priced by rarity x wear x scarcity x recent demand ----
-- scarcity: the fewer copies players own, the pricier (up to 2.2x); demand: every sale of that item in the last 7
-- days adds 8% (up to 2x). The house sells at a 25% markup, so player listings are the bargains and show first.
create or replace function cs_ai_price(p_def text, p_float real, p_st boolean, p_seed int) returns int language sql stable set search_path = public as $$
  select greatest(1, round(cs_value(p_def, p_float, p_st)
    * (1 + 1.2 / (1 + (select count(*) from cs_items where def = p_def) / 3.0))
    * least(2.0, 1 + 0.08 * (select count(*) from cs_sales where def = p_def and at > now() - interval '7 days'))
    * 1.25 * (0.92 + (p_seed % 17) / 100.0)))::int $$;
create or replace function cs_ai_restock() returns void language plpgsql security definer set search_path = public as $$
declare last timestamptz; need int; t int; pick text; kd text; fl real; sd int; sst boolean;
begin
  select m.at into last from cs_meta m where m.k = 'ai_restock' for update;
  if last is not null and last > now() - interval '30 minutes' then return; end if;
  insert into cs_meta (k, at) values ('ai_restock', now()) on conflict (k) do update set at = now();
  delete from cs_ai_listings where created < now() - interval '36 hours';
  update cs_ai_listings a set price = cs_ai_price(a.def, a.float, a.st, a.seed);   -- reprice with the latest sales
  select 90 - count(*) into need from cs_ai_listings;
  for i in 1 .. greatest(need, 0) loop
    t := case when random() < 0.40 then 0 when random() < 0.55 then 1 when random() < 0.6 then 2 when random() < 0.65 then 3 when random() < 0.7 then 4 when random() < 0.5 then 5 else 6 end;
    select def, kind into pick, kd from cs_catalog where tier = t and crate <> 'pass' order by random() limit 1;
    if pick is null then continue; end if;
    fl := case when kd in ('agent', 'emote') then 0 else power(random(), 1.6) end; sst := kd in ('skin', 'knife') and random() < 0.08; sd := floor(random() * 1000);
    insert into cs_ai_listings (def, float, st, seed, price) values (pick, fl, sst, sd, cs_ai_price(pick, fl, sst, sd));
  end loop;
end $$;
-- the market screen: player listings first (newest), then the house stock (priciest first)
create or replace function cs_market() returns json language plpgsql security definer set search_path = public as $$
begin
  perform cs_settle_due(); perform cs_ai_restock();
  return json_build_object(
    'players', coalesce((select json_agg(l order by l.created desc) from (select id, def, float, st, seed, price, seller, seller_name, created from cs_listings order by created desc limit 200) l), '[]'::json),
    'house', coalesce((select json_agg(a order by a.price desc) from (select id, def, float, st, seed, price from cs_ai_listings) a), '[]'::json),
    'pool', cs_pool_status());
end $$;
create or replace function cs_ai_buy(p_id bigint) returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); a cs_ai_listings%rowtype; c int; u text;
begin
  if me is null then raise exception 'sign in first'; end if;
  select * into a from cs_ai_listings where id = p_id for update; if a.id is null then raise exception 'already sold'; end if;
  update cs_profiles set coins = coins - a.price where id = me and coins >= a.price returning coins into c;
  if c is null then raise exception 'Not enough coins'; end if;
  delete from cs_ai_listings where id = a.id;
  u := md5(random()::text || clock_timestamp()::text || me::text);
  insert into cs_items (uid, owner, def, float, st, seed) values (u, me, a.def, a.float, a.st, a.seed);
  insert into cs_sales (def, price, ai) values (a.def, a.price, true);
  perform cs_pool_add(a.price);
  return json_build_object('uid', u, 'coins', c);
end $$;

-- the pool as players see it: today's size and stat, time left, the top five, your own standing, yesterday's winners
create or replace function cs_pool_status() returns json language plpgsql security definer set search_path = public as $$
declare d date := cs_pool_day(); cat text := cs_pool_cat(cs_pool_day()); me uuid := auth.uid(); ends timestamptz;
begin
  ends := ((d::timestamp - interval '1 hour') + interval '1 day') at time zone 'America/New_York';
  return json_build_object('day', d, 'category', cat, 'coins', coalesce((select coins from cs_pool where day = d), 0), 'ends', ends,
    'players', (select count(*) from cs_daily where day = d and matches > 0),
    'top', coalesce((select json_agg(t) from (select coalesce(pr.name, 'Player') as name, (case cat when 'kills' then x.kills when 'mvps' then x.mvps else x.wins end) as stat
      from cs_daily x left join cs_profiles pr on pr.id = x.uid where x.day = d and x.matches > 0
      order by 2 desc, x.kills + x.mvps + x.wins desc, x.matches, x.uid limit 5) t), '[]'::json),
    'me', (select json_build_object('stat', case cat when 'kills' then kills when 'mvps' then mvps else wins end, 'matches', matches,
      'rank', (select count(*) + 1 from cs_daily y where y.day = d and y.matches > 0 and (case cat when 'kills' then y.kills when 'mvps' then y.mvps else y.wins end) > (case cat when 'kills' then x.kills when 'mvps' then x.mvps else x.wins end)))
      from cs_daily x where x.day = d and x.uid = me),
    'last', (select json_build_object('day', day, 'category', category, 'coins', coins, 'results', (select coalesce(jsonb_agg(e - 'uid'), '[]'::jsonb) from jsonb_array_elements(results) e),
      'mine', (select coalesce(sum((e->>'coins')::bigint), 0) from jsonb_array_elements(results) e where e->>'uid' = me::text))
      from cs_pool where settled order by day desc limit 1));
end $$;

-- coins that leave players feed the pool: wrap case opening and the player market
create or replace function cs_open_crate_pooled(p_crate text) returns json language plpgsql security definer set search_path = public as $$
declare r json;
begin
  r := cs_open_crate(p_crate);
  perform cs_pool_add((select price from cs_crates where id = p_crate));
  return r;
end $$;
create or replace function cs_buy_pooled(p_listing bigint) returns void language plpgsql security definer set search_path = public as $$
declare l cs_listings%rowtype;
begin
  select * into l from cs_listings where id = p_listing;
  perform cs_buy(p_listing);
  if l.id is not null then insert into cs_sales (def, price, ai) values (l.def, l.price, false); perform cs_pool_add(l.price - floor(l.price * 0.95)); end if;   -- the 5% fee
end $$;

revoke all on function cs_pool_add(bigint), cs_settle(date), cs_settle_due(), cs_daily_stat(uuid, jsonb), cs_ai_restock(), cs_ai_price(text, real, boolean, int) from public, anon, authenticated;
revoke all on function cs_market(), cs_ai_buy(bigint), cs_pool_status(), cs_open_crate_pooled(text), cs_buy_pooled(bigint) from public, anon;
grant execute on function cs_market(), cs_ai_buy(bigint), cs_pool_status(), cs_open_crate_pooled(text), cs_buy_pooled(bigint) to authenticated;
-- the raw versions are only reachable through the pooled ones now
revoke execute on function cs_open_crate(text), cs_buy(bigint) from authenticated;

-- ===== trading cards: PSA-style grade and provenance per item =====================================================
-- grade: below Epic is ungraded; Epic 8-9; Legendary 9, rarely 10; Funny and Mythic always 10. Set once when the
-- item first exists (it never changes). acquired / owners: when the current owner got it, and how many owners it
-- has had (a sale or trade stamps a new date and counts one more owner).
alter table cs_items add column if not exists grade int;
alter table cs_items add column if not exists acquired timestamptz default now();
alter table cs_items add column if not exists owners int not null default 1;
create or replace function cs_items_card() returns trigger language plpgsql set search_path = public as $$
declare t int;
begin
  if tg_op = 'INSERT' then
    select tier into t from cs_catalog where def = new.def;
    new.grade := case when t = 3 then (case when random() < 0.7 then 8 else 9 end) when t = 4 then (case when random() < 0.12 then 10 else 9 end) when t >= 5 then 10 else null end;
    new.acquired := now(); new.owners := 1;
  elsif new.owner is distinct from old.owner then
    new.acquired := now(); new.owners := old.owners + 1; new.grade := old.grade;
  else
    new.grade := old.grade; new.owners := old.owners; new.acquired := old.acquired;   -- nobody edits a card's history
  end if;
  return new;
end $$;
drop trigger if exists cs_items_card on cs_items;
create trigger cs_items_card before insert or update on cs_items for each row execute function cs_items_card();
-- items that existed before cards: grade them once
update cs_items i set grade = case when c.tier = 3 then (case when random() < 0.7 then 8 else 9 end) when c.tier = 4 then (case when random() < 0.12 then 10 else 9 end) when c.tier >= 5 then 10 end
  from cs_catalog c where c.def = i.def and i.grade is null and c.tier >= 3;

-- ===== NFTs: the in-game wallet (PIN-locked, created on the player's device) and the mint queue =====================
-- cs_wallets holds only the address and the PIN-encrypted key blob; nobody can read another player's row. Minting
-- is switched on by the admin (cs_nft_cfg.on) once a tree is funded; the minter (STUMF, off by default) takes queued
-- requests, mints a compressed NFT of the item's card to the player's wallet, and keeps in-game ownership in step
-- with whoever holds the NFT on-chain. A minted item is "vaulted": still yours to equip, but traded on-chain only.
create table if not exists cs_wallets (uid uuid primary key references auth.users on delete cascade, address text not null, box jsonb not null, created timestamptz default now());
create table if not exists cs_nft_cfg (id int primary key default 1 check (id = 1), rpc text not null default '', trees text[] not null default '{}', canopy int not null default 0, "on" boolean not null default false);
insert into cs_nft_cfg (id) values (1) on conflict do nothing;
create table if not exists cs_nft_queue (id bigserial primary key, item_uid text unique not null references cs_items on delete cascade, owner uuid not null, address text not null,
  status text not null default 'queued' check (status in ('queued', 'minting', 'minted', 'failed')), asset_id text, sig text, error text, created timestamptz default now(), minted timestamptz);
alter table cs_items add column if not exists nft_asset text;
alter table cs_wallets enable row level security; alter table cs_nft_cfg enable row level security; alter table cs_nft_queue enable row level security;
drop policy if exists cs_wal on cs_wallets; create policy cs_wal on cs_wallets for select using (auth.uid() = uid);
drop policy if exists cs_ncfg on cs_nft_cfg; create policy cs_ncfg on cs_nft_cfg for select using (true);
drop policy if exists cs_nq on cs_nft_queue; create policy cs_nq on cs_nft_queue for select using (auth.uid() = owner);
-- keep the wallet's address public-safe: an address is 32-44 base58 characters; the box is the encrypted key only
create or replace function cs_wallet_save(p_address text, p_box jsonb) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in first'; end if;
  if p_address !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'bad address'; end if;
  if not (p_box ? 'enc' and p_box ? 'salt' and p_box ? 'iv') or p_box->>'address' <> p_address then raise exception 'bad wallet box'; end if;
  if exists (select 1 from cs_nft_queue q join cs_wallets w on w.uid = q.owner where q.owner = me and w.address <> p_address) then
    raise exception 'This account already has NFTs in its wallet: export that wallet instead of making a new one';
  end if;
  insert into cs_wallets (uid, address, box) values (me, p_address, p_box) on conflict (uid) do update set address = excluded.address, box = excluded.box;
end $$;
-- ask for an item to be minted (only when minting is on, the item is yours, Epic+ items and outfits/emotes alike)
create or replace function cs_nft_request(p_uid text) returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); w text;
begin
  if me is null then raise exception 'sign in first'; end if;
  if not (select "on" from cs_nft_cfg where id = 1) then raise exception 'NFT minting is not open yet'; end if;
  select address into w from cs_wallets where uid = me; if w is null then raise exception 'Create your wallet first (Profile > Wallet)'; end if;
  if not exists (select 1 from cs_items where uid = p_uid and owner = me) then raise exception 'not yours'; end if;
  if exists (select 1 from cs_listings where uid = p_uid) then raise exception 'Take it off the market first'; end if;
  insert into cs_nft_queue (item_uid, owner, address) values (p_uid, me, w) on conflict (item_uid) do nothing;
  return (select json_build_object('status', status, 'asset', asset_id) from cs_nft_queue where item_uid = p_uid);
end $$;
create or replace function cs_admin_nft_cfg(p_rpc text, p_trees text[], p_canopy int, p_on boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not cs_is_admin() then raise exception 'admin only'; end if;
  update cs_nft_cfg set rpc = coalesce(p_rpc, rpc), trees = coalesce(p_trees, trees), canopy = coalesce(p_canopy, canopy), "on" = coalesce(p_on, "on") where id = 1;
end $$;
-- vaulted items: an NFT can't be sold, listed or traded inside the game (only the minter moves it, following the chain)
create or replace function cs_items_vault() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.nft_asset is not null then raise exception 'This item is an NFT now: trade it from your wallet'; end if;
    return old;
  end if;
  if old.nft_asset is not null and new.owner is distinct from old.owner and current_setting('cs.minter', true) is distinct from 'on' then
    raise exception 'This item is an NFT now: trade it from your wallet';
  end if;
  return new;
end $$;
drop trigger if exists cs_items_vault on cs_items;
create trigger cs_items_vault before update or delete on cs_items for each row execute function cs_items_vault();
create or replace function cs_items_nolist() returns trigger language plpgsql set search_path = public as $$
begin
  if exists (select 1 from cs_items where uid = new.uid and nft_asset is not null) then raise exception 'This item is an NFT now: trade it from your wallet'; end if;
  return new;
end $$;
drop trigger if exists cs_listings_nonft on cs_listings;
create trigger cs_listings_nonft before insert on cs_listings for each row execute function cs_items_nolist();
revoke all on function cs_wallet_save(text, jsonb), cs_nft_request(text), cs_admin_nft_cfg(text, text[], int, boolean) from public, anon;
grant execute on function cs_wallet_save(text, jsonb), cs_nft_request(text), cs_admin_nft_cfg(text, text[], int, boolean) to authenticated;
-- the minter (STUMF, through the database owner's access) reports results here; players can't call these
create or replace function cs_minter_done(p_id bigint, p_asset text, p_sig text) returns void language plpgsql security definer set search_path = public as $$
declare q cs_nft_queue%rowtype;
begin
  select * into q from cs_nft_queue where id = p_id for update; if q.id is null then return; end if;
  perform set_config('cs.minter', 'on', true);
  update cs_items set nft_asset = p_asset where uid = q.item_uid;
  update cs_nft_queue set status = 'minted', asset_id = p_asset, sig = p_sig, minted = now(), error = null where id = p_id;
end $$;
-- the NFT is now held by this wallet on-chain: if it belongs to a game account, the item moves there
create or replace function cs_minter_move(p_asset text, p_wallet text) returns void language plpgsql security definer set search_path = public as $$
declare who uuid;
begin
  select uid into who from cs_wallets where address = p_wallet; if who is null then return; end if;
  perform set_config('cs.minter', 'on', true);
  update cs_items set owner = who where nft_asset = p_asset and owner <> who;
end $$;
revoke all on function cs_minter_done(bigint, text, text), cs_minter_move(text, text) from public, anon, authenticated;
-- the card pictures NFTs show: a public bucket; each player may only write into their own folder
do $$ begin
  insert into storage.buckets (id, name, public) values ('cards', 'cards', true) on conflict (id) do nothing;
  drop policy if exists cs_cards_in on storage.objects;
  create policy cs_cards_in on storage.objects for insert to authenticated with check (bucket_id = 'cards' and (storage.foldername(name))[1] = auth.uid()::text);
  drop policy if exists cs_cards_up on storage.objects;
  create policy cs_cards_up on storage.objects for update to authenticated using (bucket_id = 'cards' and (storage.foldername(name))[1] = auth.uid()::text);
exception when others then raise notice 'storage not available here (%): card images need Supabase Storage', sqlerrm;
end $$;
