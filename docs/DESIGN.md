# Garbage Kingdom: design v2 (alien planet)

## Pitch
BIP is a small **modular** salvage robot on **Nébula-7**, the planet the Galactic Federation has been using as a dump for 300 years. The goal is still to clear 1,000,000 units of junk. Now the junk is space junk on a pretty alien world, and the work runs through **contracts with deadlines** from the orbital factory. Every module BIP equips changes how it looks and how it plays.

## Tone and look
- **Planet:** pastel violet soil, teal and cyan bioluminescent flora, crystal outcrops, two moons. Cleared ground blooms: glowing grass and mushrooms, and the native Glubs come back.
- **Junk:** colorful and readable, never gross. Crystals, hull plates, droid parts, capsules, glowing goo pods, rings, alien tech.
- **Style:** cartoon with an INK outline `#2a1a10` and cel shading. The UI uses the same ink outline with a solid drop shadow.

## Cast
- **BIP:** the player. Not humanoid: a core pod with one big expressive screen-eye, plus modules:
  - locomotion below;
  - an arm boom for the tool;
  - a tank on the back;
  - a sensor on top.
- **Sr. Valdemar:** old rusty robot who keeps the outpost. He built BIP from spare parts. Mentor, deadpan humor.
- **MÃE:** the AI of the Orbital Factory. She issues the contracts and is corporate and passive-aggressive. Her shuttle lands on the outpost pad to collect deliveries.
- **Glubs:** cute jelly natives hiding underground because of the junk. They reappear on cleared land. The finale is their party.

## Materials (index order is fixed)

| # | Name | Color | Was |
|---|---|---|---|
| 0 | Cristal | pink | plastic |
| 1 | Liga Estelar | steel blue | metal |
| 2 | Biogel | green | paper |
| 3 | Âmbar | orange | glass |
| 4 | Plasma | cyan | electronics |
| 5 | Relíquias | violet | rare |

## Biomes
Region indexes are unchanged; only the theme changes.

| # | Biome | Was |
|---|---|---|
| 0 | Clareira do Posto | clearing |
| 1 | Campo de Cápsulas | domestic |
| 2 | Mar de Anéis | tires |
| 3 | Cemitério de Droides | electronics |
| 4 | Ferro-Velho de Naves | cars |
| 5 | Pedreira de Meteoros | construction |
| 6 | Refinaria Abandonada | industrial |
| 7 | Ruínas Ancestrais | ruins |

## Core loop
1. Collect with BIP, or with machines, and deliver to the outpost.
2. Materials are processed into the **silos** (storage), one per material.
3. **Contracts** from MÃE ask for X units of given materials within N planet days. A planet day is 3 minutes.
4. Deliver before the deadline to earn money, reputation and sometimes a module **blueprint**.
   - Late or failed contracts cost reputation; no hard fail.
   - Reputation levels unlock bigger contracts and story chapters.
5. Spend on machines, modules and upgrades, clear more, and repeat. Pressure comes from deadlines; choice comes from which contract to take and which biome to mine (each biome yields a different material mix).

## Modules (`src/data/modules.ts`)
- **Slots:**
  - Locomoção: Monociclo, Esteiras, Patas de Aranha, Hover.
  - Tanque: Padrão, Compactador, Quântico.
  - Sensor: Olho, Radar, Scanner.
  - Braço: the tool line in `tools.ts`.
- **Visuals:** every module must be visible on BIP.
- **Unlocks:** blueprint modules are unlocked by contract rewards, then bought in the Oficina.
