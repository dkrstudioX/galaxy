// =============================================================================
// data.js — астрономические данные: планеты, луны, база.
// Только данные, никакой логики. Периоды сидерические (сутки), долготы L0
// средние на эпоху J2000 (градусы) — отсюда реалистичные взаимные положения.
// =============================================================================

// Планеты. r и dist — условные единицы мира (не в масштабе, но порядок верный).
// hasBase — вокруг этой планеты крутится Луна с игровой базой (Земля).
// rings — рисовать кольца (Сатурн). type оставлен для совместимости.
export const planets = [
    { name: 'Mercury', color: '#b5b5b5', r: 4,  dist: 70,  period: 87.969,   l0: 252.251, type: 'rocky' },
    { name: 'Venus',   color: '#e8cda0', r: 7,  dist: 110, period: 224.701,  l0: 181.980, type: 'rocky' },
    { name: 'Earth',   color: '#4488ff', r: 8,  dist: 160, period: 365.256,  l0: 100.464, type: 'earth', hasBase: true },
    { name: 'Mars',    color: '#c1440e', r: 5,  dist: 220, period: 686.980,  l0: 355.453, type: 'rocky' },
    { name: 'Jupiter', color: '#c88b3a', r: 22, dist: 380, period: 4332.589, l0: 34.396,  type: 'gas' },
    { name: 'Saturn',  color: '#e8d191', r: 18, dist: 520, period: 10759.22, l0: 49.954,  type: 'gas', rings: true },
    { name: 'Uranus',  color: '#7de8e8', r: 12, dist: 660, period: 30685.4,  l0: 313.238, type: 'ice' },
    { name: 'Neptune', color: '#3f54ba', r: 12, dist: 780, period: 60189.0,  l0: 304.880, type: 'ice' }
];

// Луна Земли: сидерический период 27.32 суток. База делает виток за условные 1 сутки.
export const moonDist = 22;          // радиус орбиты Луны от Земли
export const moonPeriod = 27.321661; // суток
export const moonL0 = 218.32;        // средняя долгота на J2000, градусы
export const baseOrbitRadius = 10;   // радиус орбиты базы вокруг Луны
export const basePeriod = 1;         // суток на виток

// Главные луны других планет: период (сутки), радиус отрисовки r, цвет c,
// стартовая фаза phase (градусы, произвольная). Порядок = порядок раскрытия
// при зуме (см. scene.js visibleMoons): первыми показываются главные луны,
// при росте зума добавляются всё более мелкие/дальних.
export const moonsByPlanet = {
    Mars: [
        { n: 'Phobos',   period: 0.3189, r: 1.5, c: '#9c8f84', phase: 40 },
        { n: 'Deimos',   period: 1.2624, r: 1.3, c: '#b3a89e', phase: 150 }
    ],
    Jupiter: [
        { n: 'Io',       period: 1.769,  r: 2.3, c: '#d8c26a', phase: 70 },
        { n: 'Europa',   period: 3.551,  r: 2.0, c: '#cbb8a0', phase: 190 },
        { n: 'Ganymede', period: 7.155,  r: 2.7, c: '#9a8f85', phase: 300 },
        { n: 'Callisto', period: 16.689, r: 2.5, c: '#7d746c', phase: 20 },
        { n: 'Amalthea', period: 0.498,  r: 1.2, c: '#b06a4a', phase: 130 },
        { n: 'Himalia',  period: 250.6,  r: 1.2, c: '#8a8078', phase: 45 }
    ],
    Saturn: [
        { n: 'Mimas',    period: 0.942,  r: 1.5, c: '#b8bcc2', phase: 110 },
        { n: 'Enceladus',period: 1.370,  r: 1.7, c: '#d9dee3', phase: 250 },
        { n: 'Rhea',     period: 4.518,  r: 1.9, c: '#a8adb5', phase: 330 },
        { n: 'Titan',    period: 15.945, r: 2.9, c: '#c79b5a', phase: 80 },
        { n: 'Dione',    period: 2.737,  r: 1.6, c: '#c2c7cd', phase: 15 },
        { n: 'Tethys',   period: 1.888,  r: 1.6, c: '#ccd1d6', phase: 200 },
        { n: 'Iapetus',  period: 79.32,  r: 1.7, c: '#8f8478', phase: 300 }
    ],
    Uranus: [
        { n: 'Miranda',  period: 1.413,  r: 1.4, c: '#a9b3b8', phase: 210 },
        { n: 'Ariel',    period: 2.520,  r: 1.7, c: '#b6c0c4', phase: 20 },
        { n: 'Umbriel',  period: 4.144,  r: 1.5, c: '#7e888d', phase: 95 },
        { n: 'Titania',  period: 8.706,  r: 2.1, c: '#9aa5ab', phase: 140 },
        { n: 'Oberon',   period: 13.463, r: 2.0, c: '#8b969c', phase: 260 },
        { n: 'Puck',     period: 0.762,  r: 1.1, c: '#9c9a94', phase: 175 }
    ],
    Neptune: [
        { n: 'Proteus',  period: 1.122,  r: 1.5, c: '#8f9aa3', phase: 310 },
        { n: 'Triton',   period: 5.877,  r: 2.3, c: '#c3cdd4', phase: 100 },
        { n: 'Nereid',   period: 360.1,  r: 1.2, c: '#9aa2ab', phase: 220 }
    ]
};

// Данные для боковой панели «ЛУНЫ СИСТЕМЫ»: имя + период для показа.
export const moonTree = {
    Mercury: [],
    Venus:   [],
    Earth:   [['Луна / Moon', '27.32 d']],
    Mars:    [['Phobos', '0.32 d'], ['Deimos', '1.26 d']],
    Jupiter: [['Io', '1.77 d'], ['Europa', '3.55 d'], ['Ganymede', '7.15 d'], ['Callisto', '16.69 d']],
    Saturn:  [['Mimas', '0.94 d'], ['Enceladus', '1.37 d'], ['Rhea', '4.52 d'], ['Titan', '15.95 d']],
    Uranus:  [['Miranda', '1.41 d'], ['Ariel', '2.52 d'], ['Titania', '8.71 d'], ['Oberon', '13.46 d']],
    Neptune: [['Proteus', '1.12 d'], ['Triton', '5.88 d']]
};

// Известное общее число лун у каждой планеты (для счётчика «☾ N» в панели).
export const moonTotals = { Mercury: 0, Venus: 0, Earth: 1, Mars: 2, Jupiter: 95, Saturn: 146, Uranus: 28, Neptune: 16 };
