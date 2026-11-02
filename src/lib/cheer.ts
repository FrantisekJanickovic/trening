const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const PRAISE = ["Výborne!", "Presne tak!", "Skvelá práca!", "Paráda!", "Bravó!", "To sedí!", "Super, ide ti to!", "{name}, výborne!", "Si šikovný pravopisár!"];
const REASSURE = [
  "Nevadí, chyby k učeniu patria.",
  "Skoro! Toto si ešte zopakujeme.",
  "Nič sa nedeje, ide sa ďalej.",
  "Dobrý pokus, {name}!",
  "Zapamätaj si ho, o chvíľu príde znova.",
];
const STREAK: Record<number, string[]> = {
  3: ["Tri správne za sebou!", "Trojka v rade, len tak ďalej!"],
  5: ["Päť v rade! Si v ohni!", "Päťka za sebou, {name}!"],
  10: ["Desať v rade! To je rekord!", "Desaťka! Neuveriteľné!"],
  15: ["Pätnásť bez chyby! Si majster!"],
  20: ["Dvadsať v rade! Pravopisný šampión!"],
};
const SPOT_OK = ["Máš oči ako sokol!", "Detektív {name} to vyriešil!", "Nič ti neujde!"];
const HALFWAY = ["Už si v polovici, len tak ďalej!", "Polovica je za tebou!"];
const LAST = ["Posledná úloha!", "Ešte posledná a máš hotovo!"];
const START = ["Ideme na to, {name}!", "Ahoj {name}, poďme trénovať!", "Začíname, {name}!"];

const fill = (s: string, name: string) => s.replace("{name}", name);

export const cheer = {
  praise: (name: string) => fill(pick(PRAISE), name),
  reassure: (name: string) => fill(pick(REASSURE), name),
  streak: (n: number, name: string) => (STREAK[n] ? fill(pick(STREAK[n]), name) : null),
  spot: (name: string) => fill(pick(SPOT_OK), name),
  halfway: (name: string) => fill(pick(HALFWAY), name),
  last: (name: string) => fill(pick(LAST), name),
  start: (name: string) => fill(pick(START), name),
};
