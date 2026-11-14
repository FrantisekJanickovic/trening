const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const PRAISE = ["Výborne!", "Presne tak!", "Skvelá práca!", "Paráda!", "Bravó!", "To sedí!", "Super, ide ti to!", "{name}, výborne!"];

const REASSURE = [
  "Nevadí, chyby k učeniu patria.",
  "Skoro! Nabudúce to dáš.",
  "Toto si ešte zopakujeme.",
  "Nič sa nedeje, ide sa ďalej.",
  "Dobrý pokus, {name}!",
];

const STREAK: Record<number, string[]> = {
  3: ["Tri správne za sebou!", "Trojka v rade, len tak ďalej!"],
  5: ["Päť v rade! Si v ohni!", "Päťka za sebou, {name}!"],
  10: ["Desať v rade! To je rekord!", "Desaťka! Neuveriteľné!"],
};

const HALFWAY = ["Už si v polovici, len tak ďalej!", "Polovica je za tebou!"];
const LAST = ["Posledné slovíčko!", "Ešte posledné a máš hotovo!"];
const START = ["Ideme na to, {name}!", "Ahoj {name}, poďme sa učiť!", "Začíname, {name}!"];
const FINISH = ["Hotovo! Zase pár slovíčok v hlave navyše.", "Super tréning, {name}!", "Výborná práca, tréning je za tebou!"];

const fill = (s: string, name: string) => s.replace("{name}", name);

export const phrases = {
  praise: (name: string) => fill(pick(PRAISE), name),
  reassure: (name: string) => fill(pick(REASSURE), name),
  streak: (n: number, name: string) => (STREAK[n] ? fill(pick(STREAK[n]), name) : null),
  halfway: (name: string) => fill(pick(HALFWAY), name),
  last: (name: string) => fill(pick(LAST), name),
  start: (name: string) => fill(pick(START), name),
  finish: (name: string) => fill(pick(FINISH), name),
};
