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

insert into cs_crates (id, price) values ('sand',250),('toilet',250),('nuke',300),('agents',350) on conflict (id) do update set price = excluded.price;
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
('toilet:k_hotdog:Vanilla','toilet',4,'knife'),
('toilet:k_hotdog:Fade','toilet',4,'knife'),
('toilet:k_hotdog:Doppler','toilet',4,'knife'),
('toilet:k_hotdog:Tiger Tooth','toilet',4,'knife'),
('toilet:k_hotdog:Crimson Web','toilet',4,'knife'),
('toilet:k_hotdog:Marble Fade','toilet',4,'knife'),
('toilet:k_dildo:Vanilla','toilet',4,'knife'),
('toilet:k_dildo:Fade','toilet',4,'knife'),
('toilet:k_dildo:Doppler','toilet',4,'knife'),
('toilet:k_dildo:Tiger Tooth','toilet',4,'knife'),
('toilet:k_dildo:Crimson Web','toilet',4,'knife'),
('toilet:k_dildo:Marble Fade','toilet',4,'knife'),
('toilet:k_plunger:Vanilla','toilet',4,'knife'),
('toilet:k_plunger:Fade','toilet',4,'knife'),
('toilet:k_plunger:Doppler','toilet',4,'knife'),
('toilet:k_plunger:Tiger Tooth','toilet',4,'knife'),
('toilet:k_plunger:Crimson Web','toilet',4,'knife'),
('toilet:k_plunger:Marble Fade','toilet',4,'knife'),
('toilet:k_chicken:Vanilla','toilet',4,'knife'),
('toilet:k_chicken:Fade','toilet',4,'knife'),
('toilet:k_chicken:Doppler','toilet',4,'knife'),
('toilet:k_chicken:Tiger Tooth','toilet',4,'knife'),
('toilet:k_chicken:Crimson Web','toilet',4,'knife'),
('toilet:k_chicken:Marble Fade','toilet',4,'knife'),
('toilet:deagle:Finger Gun','toilet',2,'skin'),
('nuke:usp:Glow Lawn','nuke',0,'skin'),
('nuke:r8:Hazmat','nuke',0,'skin'),
('nuke:mac10:Picket Fence','nuke',0,'skin'),
('nuke:r8:Fallout Fade','nuke',1,'skin'),
('nuke:tec9:Duck & Cover','nuke',1,'skin'),
('nuke:nova:Half-Life Hex','nuke',2,'skin'),
('nuke:p2000:Mushroom Cloud','nuke',2,'skin'),
('nuke:ak47:Chernobyl Sunset','nuke',3,'skin'),
('nuke:k_baguette:Vanilla','nuke',4,'knife'),
('nuke:k_baguette:Fade','nuke',4,'knife'),
('nuke:k_baguette:Doppler','nuke',4,'knife'),
('nuke:k_baguette:Tiger Tooth','nuke',4,'knife'),
('nuke:k_baguette:Crimson Web','nuke',4,'knife'),
('nuke:k_baguette:Marble Fade','nuke',4,'knife'),
('nuke:k_fish:Vanilla','nuke',4,'knife'),
('nuke:k_fish:Fade','nuke',4,'knife'),
('nuke:k_fish:Doppler','nuke',4,'knife'),
('nuke:k_fish:Tiger Tooth','nuke',4,'knife'),
('nuke:k_fish:Crimson Web','nuke',4,'knife'),
('nuke:k_fish:Marble Fade','nuke',4,'knife'),
('nuke:k_banana:Vanilla','nuke',4,'knife'),
('nuke:k_banana:Fade','nuke',4,'knife'),
('nuke:k_banana:Doppler','nuke',4,'knife'),
('nuke:k_banana:Tiger Tooth','nuke',4,'knife'),
('nuke:k_banana:Crimson Web','nuke',4,'knife'),
('nuke:k_banana:Marble Fade','nuke',4,'knife'),
('agents:a_t_ops','agents',1,'agent'),
('agents:a_ct_swat','agents',1,'agent'),
('agents:a_t_speedo','agents',2,'agent'),
('agents:a_ct_tighty','agents',2,'agent'),
('agents:a_t_hotdog','agents',3,'agent'),
('agents:a_ct_poo','agents',3,'agent'),
('agents:a_t_grandma','agents',2,'agent'),
('agents:a_ct_pigeon','agents',3,'agent'),
('agents:a_t_banana','agents',1,'agent'),
('agents:a_ct_mime','agents',1,'agent'),
('pass1:glock:Participation Trophy','pass',0,'skin'),
('pass2:usp:Grass Toucher','pass',0,'skin'),
('pass3:e_dance','pass',1,'emote'),
('pass4:ak47:Mom''s Basement','pass',0,'skin'),
('pass5:a_t_banana','pass',1,'agent'),
('pass6:e_dab','pass',1,'emote'),
('pass7:m4a4:Gamer Fuel','pass',0,'skin'),
('pass8:awp:Sweaty Palms','pass',0,'skin'),
('pass9:e_tpose','pass',2,'emote'),
('pass10:a_ct_mime','pass',1,'agent'),
('pass11:deagle:No Life','pass',0,'skin'),
('pass12:e_floss','pass',2,'emote'),
('pass13:mp9:Touch Grass Pro','pass',1,'skin'),
('pass14:mac10:Hall of Shame','pass',1,'skin'),
('pass15:a_t_speedo','pass',2,'agent'),
('pass16:p90:Certified Clown','pass',1,'skin'),
('pass17:galil:Rainbow Road Rage','pass',1,'skin'),
('pass18:e_chicken','pass',2,'emote'),
('pass19:famas:Participation Trophy','pass',1,'skin'),
('pass20:a_ct_tighty','pass',2,'agent'),
('pass21:e_fart','pass',3,'emote'),
('pass22:nova:Grass Toucher','pass',1,'skin'),
('pass23:ump:Mom''s Basement','pass',1,'skin'),
('pass24:e_worm','pass',3,'emote'),
('pass25:k_hotdog:Ballpark Special','pass',4,'knife'),
('pass26:ssg08:Gamer Fuel','pass',2,'skin'),
('pass27:e_flex','pass',1,'emote'),
('pass28:p250:Sweaty Palms','pass',2,'skin'),
('pass29:m4a1s:No Life','pass',2,'skin'),
('pass30:a_t_grandma','pass',3,'agent'),
('pass31:sg553:Touch Grass Pro','pass',2,'skin'),
('pass32:aug:Hall of Shame','pass',2,'skin'),
('pass33:e_cry','pass',1,'emote'),
('pass34:tec9:Certified Clown','pass',2,'skin'),
('pass35:a_ct_pigeon','pass',3,'agent'),
('pass36:e_twerk','pass',3,'emote'),
('pass37:fiveseven:Rainbow Road Rage','pass',3,'skin'),
('pass38:glock:Participation Trophy','pass',3,'skin'),
('pass39:usp:Grass Toucher','pass',3,'skin'),
('pass40:a_t_hotdog','pass',3,'agent'),
('pass41:ak47:Mom''s Basement','pass',3,'skin'),
('pass42:m4a4:Gamer Fuel','pass',3,'skin'),
('pass43:awp:Sweaty Palms','pass',3,'skin'),
('pass44:deagle:No Life','pass',3,'skin'),
('pass45:a_ct_poo','pass',3,'agent'),
('pass46:mp9:Touch Grass Pro','pass',3,'skin'),
('pass47:mac10:Hall of Shame','pass',3,'skin'),
('pass48:p90:Certified Clown','pass',3,'skin'),
('pass49:galil:Rainbow Road Rage','pass',3,'skin'),
('pass50:k_dildo:Gold Plated','pass',4,'knife'),
('pass:e_wave','pass',0,'emote'),
('pass:e_salute','pass',0,'emote')
on conflict (def) do update set crate = excluded.crate, tier = excluded.tier, kind = excluded.kind;
insert into cs_pass (tier, def) values (1,'pass1:glock:Participation Trophy'),(2,'pass2:usp:Grass Toucher'),(3,'pass3:e_dance'),(4,'pass4:ak47:Mom''s Basement'),(5,'pass5:a_t_banana'),(6,'pass6:e_dab'),(7,'pass7:m4a4:Gamer Fuel'),(8,'pass8:awp:Sweaty Palms'),(9,'pass9:e_tpose'),(10,'pass10:a_ct_mime'),(11,'pass11:deagle:No Life'),(12,'pass12:e_floss'),(13,'pass13:mp9:Touch Grass Pro'),(14,'pass14:mac10:Hall of Shame'),(15,'pass15:a_t_speedo'),(16,'pass16:p90:Certified Clown'),(17,'pass17:galil:Rainbow Road Rage'),(18,'pass18:e_chicken'),(19,'pass19:famas:Participation Trophy'),(20,'pass20:a_ct_tighty'),(21,'pass21:e_fart'),(22,'pass22:nova:Grass Toucher'),(23,'pass23:ump:Mom''s Basement'),(24,'pass24:e_worm'),(25,'pass25:k_hotdog:Ballpark Special'),(26,'pass26:ssg08:Gamer Fuel'),(27,'pass27:e_flex'),(28,'pass28:p250:Sweaty Palms'),(29,'pass29:m4a1s:No Life'),(30,'pass30:a_t_grandma'),(31,'pass31:sg553:Touch Grass Pro'),(32,'pass32:aug:Hall of Shame'),(33,'pass33:e_cry'),(34,'pass34:tec9:Certified Clown'),(35,'pass35:a_ct_pigeon'),(36,'pass36:e_twerk'),(37,'pass37:fiveseven:Rainbow Road Rage'),(38,'pass38:glock:Participation Trophy'),(39,'pass39:usp:Grass Toucher'),(40,'pass40:a_t_hotdog'),(41,'pass41:ak47:Mom''s Basement'),(42,'pass42:m4a4:Gamer Fuel'),(43,'pass43:awp:Sweaty Palms'),(44,'pass44:deagle:No Life'),(45,'pass45:a_ct_poo'),(46,'pass46:mp9:Touch Grass Pro'),(47,'pass47:mac10:Hall of Shame'),(48,'pass48:p90:Certified Clown'),(49,'pass49:galil:Rainbow Road Rage'),(50,'pass50:k_dildo:Gold Plated') on conflict (tier) do update set def = excluded.def;

create or replace function cs_profile(p_name text) returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'sign in first'; end if;
  insert into cs_profiles (id, name) values (me, left(coalesce(nullif(p_name, ''), 'Player'), 20)) on conflict (id) do nothing;
  return (select json_build_object('name', p.name, 'coins', p.coins, 'xp', p.xp, 'equipped', p.equipped, 'stats', p.stats, 'pass', p.pass_claimed,
    'items', coalesce((select json_agg(json_build_object('uid', i.uid, 'def', i.def, 'float', i.float, 'st', i.st, 'seed', i.seed, 'kills', i.kills,
      'created', i.created, 'listed', (select l.price from cs_listings l where l.uid = i.uid)) order by i.created desc) from cs_items i where i.owner = me), '[]'::json))
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
  return json_build_object('coins', r.coins, 'xp', r.xp, 'granted', give);
end $$;

create or replace function cs_open_crate(p_crate text) returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); pr int; c int; roll float8; tot float8; acc float8 := 0; t int; pick text; k text; u text; fl real; isst boolean; sd int;
begin
  if me is null then raise exception 'sign in first'; end if;
  select price into pr from cs_crates where id = p_crate; if pr is null then raise exception 'no such crate'; end if;
  update cs_profiles set coins = coins - pr where id = me and coins >= pr returning coins into c;
  if c is null then raise exception 'Not enough coins'; end if;
  select sum((array[79.92,15.98,3.2,0.64,0.26]::float8[])[s.tier + 1]) into tot from (select distinct tier from cs_catalog where crate = p_crate) s;
  roll := random() * tot;
  for t in select distinct tier from cs_catalog where crate = p_crate order by tier loop
    acc := acc + (array[79.92,15.98,3.2,0.64,0.26]::float8[])[t + 1];
    exit when roll < acc;
  end loop;
  select def, kind into pick, k from cs_catalog where crate = p_crate and tier = t order by random() limit 1;
  u := md5(random()::text || clock_timestamp()::text || me::text);
  fl := case when k = 'agent' then 0 else random() end; isst := k <> 'agent' and random() < 0.1; sd := floor(random() * 1000);
  insert into cs_items (uid, owner, def, float, st, seed) values (u, me, pick, fl, isst, sd);
  return json_build_object('uid', u, 'def', pick, 'float', fl, 'st', isst, 'seed', sd, 'coins', c);
end $$;

create or replace function cs_value(p_def text, p_float real, p_st boolean) returns int language sql stable set search_path = public as $$
  select round((array[30,120,500,2000,8000])[c.tier + 1] * (case when c.kind = 'agent' then 1.5 when c.kind = 'emote' then 0.8 when p_float < 0.07 then 1.5 when p_float < 0.15 then 1.15 when p_float < 0.38 then 1
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

revoke all on function cs_claim_pass(int), cs_profile(text), cs_reward(text, int, int, jsonb), cs_open_crate(text), cs_sell(text), cs_list(text, int), cs_unlist(text), cs_buy(bigint), cs_equip(jsonb) from public, anon;
grant execute on function cs_claim_pass(int), cs_profile(text), cs_reward(text, int, int, jsonb), cs_open_crate(text), cs_sell(text), cs_list(text, int), cs_unlist(text), cs_buy(bigint), cs_equip(jsonb) to authenticated;
revoke all on function cs_value(text, real, boolean) from public, anon;
