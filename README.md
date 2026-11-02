# Tréning

Rodinná appka na precvičovanie školských predmetov. Rodič nafotí lekciu z učebnice, AI z nej vyrobí cvičenia, dieťa trénuje na mobile. Prvý predmet je **dejepis**; ďalšie predmety sa pridávajú ako dáta, nie ako nový kód.

## Ako to funguje

1. Rodič pridá lekciu v predmete a nafotí strany z učebnice.
2. AI strany prepíše a rozdelí na časti. Rodič prepis skontroluje a opraví.
3. Tlačidlo **Generovať cvičenia** vyrobí zadaný počet cvičení (predvolene 20) z nahratého materiálu.
4. Každé cvičenie sa dá upraviť, vypnúť, zmazať alebo ručne pridať.
5. Dieťa si vyberie predmet, lekcie a počet otázok a trénuje.
6. Čo mu nešlo, sa uloží. Vie si pustiť tréning **len na chyby**; po niekoľkých správnych odpovediach je cvičenie zvládnuté.
7. Rodič dostane po tréningu správu so skóre.

## Univerzálny základ

Appka je postavená z troch vrstiev:

- **Predmet** je položka v `src/data/subjects.ts` a riadok v tabuľke `tr_subjects`. Obsahuje názov, ikonu a pokyny pre AI (na čo si dať v predmete pozor). Zapína sa pre deti v rodičovskej zóne.
- **Typ cvičenia** je zápis v `src/lib/exercises.ts` (obsah, kontrola, vyhodnotenie, JSON schéma pre AI) plus prehrávač v `src/components/exercise/players.tsx` a editor v `src/components/exercise/editors.tsx`. Zatiaľ: výber z možností (aj viac správnych), pravda/nepravda, spájanie dvojíc, doplňovačka v texte, usporiadanie.
- **Engine** je zvyšok appky: import materiálu, generovanie, skladba tréningu, chyby a zvládnutie, história, správy. O konkrétnom predmete ani type cvičenia nevie nič.

Adresy sú od začiatku podľa predmetu (`/predmet/dejepis`, `/rodic/dejepis`), aby sa dalo neskôr prejsť na jednu doménu s viacerými predmetmi.

## Stack

Next.js 16 (PWA), Tailwind 4, Supabase (Auth, Postgres s RLS), Vercel, OpenAI (Responses API, prepis fotiek aj generovanie cvičení).
Databáza je spoločná s appkami Angličtina a Vybrané slová (tabuľky `tr_*`), takže rodina má jeden účet, jeden PIN a tie isté profily detí.

## Premenné prostredia

Pozri `.env.example`. Povinné sú `NEXT_PUBLIC_SUPABASE_*`. `OPENAI_API_KEY` je potrebný na prepis fotiek a generovanie cvičení (model `gpt-6-sol`, mení sa cez `OPENAI_MODEL`).

## Vývoj

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Čo ešte nie je

- E-mailové a push správy pre rodiča (zatiaľ len v appke pod **Správy**).
- Typy cvičení naviazané na predmet: mapa pre geografiu, rovnice pre chémiu.
- Kontrola vygenerovaných cvičení druhým modelom.
