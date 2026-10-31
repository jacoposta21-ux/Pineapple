// Menu labels. The title stays "Pineapple Simulator" everywhere.
const STRINGS = {
  en: { arcade: 'Arcade Mode', realistic: 'Realistic Mode', soundOn: 'Sound: On', soundOff: 'Sound: Off', menu: 'Menu', sound: 'Sound' },
  it: { arcade: 'Modalità Arcade', realistic: 'Modalità Realistica', soundOn: 'Audio: On', soundOff: 'Audio: Off', menu: 'Menu', sound: 'Audio' },
  es: { arcade: 'Modo Arcade', realistic: 'Modo Realista', soundOn: 'Sonido: Sí', soundOff: 'Sonido: No', menu: 'Menú', sound: 'Sonido' },
  fr: { arcade: 'Mode Arcade', realistic: 'Mode Réaliste', soundOn: 'Son : Oui', soundOff: 'Son : Non', menu: 'Menu', sound: 'Son' },
  de: { arcade: 'Arcade-Modus', realistic: 'Realistischer Modus', soundOn: 'Ton: An', soundOff: 'Ton: Aus', menu: 'Menü', sound: 'Ton' },
  pt: { arcade: 'Modo Arcade', realistic: 'Modo Realista', soundOn: 'Som: Ligado', soundOff: 'Som: Desligado', menu: 'Menu', sound: 'Som' },
  ru: { arcade: 'Аркадный режим', realistic: 'Реалистичный режим', soundOn: 'Звук: Вкл', soundOff: 'Звук: Выкл', menu: 'Меню', sound: 'Звук' },
  tr: { arcade: 'Arcade Modu', realistic: 'Gerçekçi Mod', soundOn: 'Ses: Açık', soundOff: 'Ses: Kapalı', menu: 'Menü', sound: 'Ses' },
};

export function translate(lang) {
  const key = STRINGS[lang] ? lang : 'en';
  return { lang: key, ...STRINGS[key] };
}
