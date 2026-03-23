/**
 * patterns.js
 * SVG <defs> с орнаментальными паттернами народов России.
 * Источники: вологодская вышивка, карельская тамбурная вышивка,
 * адыгское шитьё, кавказская геометрия, татарский орнамент,
 * хантыйский нёр-ях, бурятский буддийский орнамент, якутская аппликация.
 */

export const PATTERNS_DEFS = `
<defs id="ornament-defs">

  <!-- ЦФО · Русский Север (Вологодская, Архангельская обл.)
       Ромб-«репей» с четырьмя крючками — засеянное поле.
       Красный по льняному белому. -->
  <pattern id="PP-central" patternUnits="userSpaceOnUse" width="20" height="20">
    <rect width="20" height="20" fill="#f5ede0"/>
    <polygon points="10,1 19,10 10,19 1,10" fill="#8b1a1a"/>
    <line x1="1"  y1="10" x2="19" y2="10" stroke="#f5ede0" stroke-width="1.6"/>
    <line x1="10" y1="1"  x2="10" y2="19" stroke="#f5ede0" stroke-width="1.6"/>
    <polyline points="10,1 14,1 14,-1"  fill="none" stroke="#8b1a1a" stroke-width="1.1"/>
    <polyline points="19,10 19,14 21,14" fill="none" stroke="#8b1a1a" stroke-width="1.1"/>
    <polyline points="10,19 6,19 6,21"   fill="none" stroke="#8b1a1a" stroke-width="1.1"/>
    <polyline points="1,10 1,6 -1,6"     fill="none" stroke="#8b1a1a" stroke-width="1.1"/>
  </pattern>

  <!-- СЗФО · Карелы, Вепсы, Коми
       Восьмиконечная звезда-розетка — солярный знак.
       Карельская тамбурная вышивка: красный+синий по белому. -->
  <pattern id="PP-northwest" patternUnits="userSpaceOnUse" width="22" height="22">
    <rect width="22" height="22" fill="#ddf0f8"/>
    <polygon points="11,1 12.6,7.4 17.8,4.3 14.6,9.4 21,11 14.6,12.6 17.8,17.7 12.6,14.6 11,21 9.4,14.6 4.2,17.7 7.4,12.6 1,11 7.4,9.4 4.2,4.3 9.4,7.4" fill="#1a3a6e"/>
    <circle cx="11" cy="11" r="2.4" fill="#ddf0f8"/>
    <circle cx="11" cy="11" r="1.1" fill="#1a3a6e"/>
    <line x1="0" y1="0" x2="3.5" y2="3.5" stroke="#8b1a1a" stroke-width="1.1"/>
    <line x1="3.5" y1="0" x2="0" y2="3.5" stroke="#8b1a1a" stroke-width="1.1"/>
    <line x1="18.5" y1="0" x2="22" y2="3.5" stroke="#8b1a1a" stroke-width="1.1"/>
    <line x1="22" y1="0" x2="18.5" y2="3.5" stroke="#8b1a1a" stroke-width="1.1"/>
  </pattern>

  <!-- ЮФО · Адыги, Казаки, Калмыки
       Растительный завиток с золотом по тёмному —
       адыгское золотое шитьё. -->
  <pattern id="PP-south" patternUnits="userSpaceOnUse" width="24" height="24">
    <rect width="24" height="24" fill="#1a2808"/>
    <path d="M12,3 Q18.5,3 19.5,9.5 Q20.5,16 14,19 Q7.5,22 4.5,16 Q1.5,10 6,6.5 Q10,3 12,3Z"
          fill="none" stroke="#d4a030" stroke-width="1.6"/>
    <path d="M12,3  Q15,0.5 18.5,3"  fill="none" stroke="#d4a030" stroke-width="1.2"/>
    <path d="M19.5,9.5 Q22.5,11 21,15.5" fill="none" stroke="#d4a030" stroke-width="1.2"/>
    <path d="M12,19 Q9,22 5.5,20"   fill="none" stroke="#d4a030" stroke-width="1.2"/>
    <circle cx="12" cy="12" r="2.6" fill="#d4a030"/>
    <circle cx="2.5"  cy="2.5"  r="1.5" fill="#d4a030"/>
    <circle cx="21.5" cy="2.5"  r="1.5" fill="#d4a030"/>
    <circle cx="2.5"  cy="21.5" r="1.5" fill="#d4a030"/>
    <circle cx="21.5" cy="21.5" r="1.5" fill="#d4a030"/>
  </pattern>

  <!-- СКФО · Чеченцы, Дагестанцы, Осетины
       Двойной рог барана (символ мужества) — кавказская геометрия.
       Кайтагская вышивка Дагестана. -->
  <pattern id="PP-ncfd" patternUnits="userSpaceOnUse" width="22" height="22">
    <rect width="22" height="22" fill="#f2ebe0"/>
    <line x1="0" y1="1"  x2="22" y2="1"  stroke="#7a1a0a" stroke-width="1.6"/>
    <line x1="0" y1="21" x2="22" y2="21" stroke="#7a1a0a" stroke-width="1.6"/>
    <path d="M3,11 Q3,4 11,4 Q15,4 15,8 Q15,11 11,11 Q9,11 9,9.2 Q9,7.5 11,7.5"
          fill="none" stroke="#7a1a0a" stroke-width="2"/>
    <path d="M19,11 Q19,18 11,18 Q7,18 7,14 Q7,11 11,11 Q13,11 13,12.8 Q13,14.5 11,14.5"
          fill="none" stroke="#7a1a0a" stroke-width="2"/>
  </pattern>

  <!-- ПФО · Татары, Башкиры, Чуваши, Марийцы
       Тюльпан с боковыми лепестками — татарский орнамент.
       Влияние ислама: нет людей и животных. -->
  <pattern id="PP-volga" patternUnits="userSpaceOnUse" width="22" height="28">
    <rect width="22" height="28" fill="#f8f0e8"/>
    <line x1="11" y1="28" x2="11" y2="17" stroke="#3a6820" stroke-width="1.6"/>
    <path d="M11,17 Q8,13.5 8,9.5 Q8,3 11,3 Q14,3 14,9.5 Q14,13.5 11,17Z"  fill="#5a1f8a"/>
    <path d="M11,17 Q8.5,14 8.5,11 Q8.5,7 11,7 Q13.5,7 13.5,11 Q13.5,14 11,17Z" fill="#f8f0e8"/>
    <path d="M11,17 Q9.5,14.5 9.5,12 Q9.5,9.5 11,9.5 Q12.5,9.5 12.5,12 Q12.5,14.5 11,17Z" fill="#5a1f8a"/>
    <path d="M11,17 Q6,15 4,18.5 Q7.5,22.5 11,17Z"  fill="#5a1f8a"/>
    <path d="M11,17 Q16,15 18,18.5 Q14.5,22.5 11,17Z" fill="#5a1f8a"/>
    <circle cx="3"  cy="25" r="2.2" fill="#3a6820"/>
    <circle cx="19" cy="25" r="2.2" fill="#3a6820"/>
  </pattern>

  <!-- УФО · Ханты, Манси, Ненцы, Башкиры
       Нёр-ях — меховой орнамент: полосы-«дороги» + ромб жизни.
       Передаётся от матери к дочери как родовой код. -->
  <pattern id="PP-ural" patternUnits="userSpaceOnUse" width="18" height="18">
    <rect width="18" height="18" fill="#e8e4d8"/>
    <rect x="0" y="0"  width="18" height="4"  fill="#2a5020"/>
    <rect x="0" y="14" width="18" height="4"  fill="#2a5020"/>
    <polygon points="9,5 14,9 9,13 4,9"    fill="#2a5020"/>
    <polygon points="9,7 12,9 9,11 6,9"    fill="#e8e4d8"/>
    <polygon points="9,8.2 10.5,9 9,9.8 7.5,9" fill="#2a5020"/>
  </pattern>

  <!-- СФО · Буряты, Алтайцы, Тувинцы, Хакасы
       Бесконечный узел (буддийский) + золотые углы.
       Символ вечности и взаимосвязи всего сущего. -->
  <pattern id="PP-siberia" patternUnits="userSpaceOnUse" width="24" height="24">
    <rect width="24" height="24" fill="#e6f2f8"/>
    <rect x="7" y="7" width="10" height="10" fill="none" stroke="#0a2a4a" stroke-width="2.2"/>
    <line x1="9"  y1="7"  x2="9"  y2="3.5" stroke="#0a2a4a" stroke-width="1.8"/>
    <line x1="15" y1="7"  x2="15" y2="3.5" stroke="#0a2a4a" stroke-width="1.8"/>
    <line x1="9"  y1="17" x2="9"  y2="20.5" stroke="#0a2a4a" stroke-width="1.8"/>
    <line x1="15" y1="17" x2="15" y2="20.5" stroke="#0a2a4a" stroke-width="1.8"/>
    <line x1="7"  y1="9"  x2="3.5" y2="9"  stroke="#0a2a4a" stroke-width="1.8"/>
    <line x1="7"  y1="15" x2="3.5" y2="15" stroke="#0a2a4a" stroke-width="1.8"/>
    <line x1="17" y1="9"  x2="20.5" y2="9"  stroke="#0a2a4a" stroke-width="1.8"/>
    <line x1="17" y1="15" x2="20.5" y2="15" stroke="#0a2a4a" stroke-width="1.8"/>
    <rect x="10.5" y="10.5" width="3" height="3" fill="#c9952a"/>
    <circle cx="2"  cy="2"  r="2" fill="#c9952a"/>
    <circle cx="22" cy="2"  r="2" fill="#c9952a"/>
    <circle cx="2"  cy="22" r="2" fill="#c9952a"/>
    <circle cx="22" cy="22" r="2" fill="#c9952a"/>
  </pattern>

  <!-- ДФО · Якуты (Саха), Эвенки, Нанайцы, Чукчи
       Лировидный узор — стилизованное Древо жизни.
       Аппликация на бересте и меху, шаманская символика. -->
  <pattern id="PP-fareast" patternUnits="userSpaceOnUse" width="20" height="26">
    <rect width="20" height="26" fill="#f0ece0"/>
    <path d="M10,2 Q5,6.5 5,11.5 Q5,17.5 10,19.5 Q15,17.5 15,11.5 Q15,6.5 10,2Z" fill="#1a2a4a"/>
    <path d="M10,5.5 Q8,8.5 8,11.5 Q8,14.5 10,15.5 Q12,14.5 12,11.5 Q12,8.5 10,5.5Z" fill="#f0ece0"/>
    <path d="M10,8 Q9,9.5 9,11.5 Q9,13 10,13.5 Q11,13 11,11.5 Q11,9.5 10,8Z" fill="#1a2a4a"/>
    <line x1="10" y1="19.5" x2="10" y2="24.5" stroke="#1a2a4a" stroke-width="2.2"/>
    <line x1="6"  y1="24.5" x2="14" y2="24.5" stroke="#1a2a4a" stroke-width="2.2"/>
    <line x1="3"  y1="1"    x2="17" y2="1"    stroke="#1a2a4a" stroke-width="1.6"/>
  </pattern>

</defs>
`;

/**
 * District metadata
 */
export const DISTRICTS = {
  central: {
    name:     'Центральный ФО',
    people:   'Русские',
    ornament: 'Ромб-«репей» с крючками · Вологодская вышивка',
    desc:     'Вологодская и архангельская вышивка: ромб-«репей» (засеянное поле) с четырьмя крючками-оберегами, птица-пава, солярная розетка. Красный по льняному белому.',
    color:    '#f5f07a',
    tags:     ['Ромб-репей', 'Крючки-оберег', 'Птица-пава', 'Красный по белому'],
  },
  northwest: {
    name:     'Северо-Западный ФО',
    people:   'Карелы, Вепсы, Коми',
    ornament: 'Восьмиконечная звезда · Карельская тамбурная вышивка',
    desc:     'Карельская вышивка: восьмиконечная звезда-розетка (солярный знак), зооморфные мотивы, косые кресты-«огневцы». Красный и синий по белому.',
    color:    '#62d2c5',
    tags:     ['Восьмиконечная звезда', 'Огневец-крест', 'Тамбурный шов'],
  },
  south: {
    name:     'Южный ФО',
    people:   'Адыги, Казаки, Калмыки',
    ornament: 'Растительный завиток · Адыгское золотое шитьё',
    desc:     'Адыгское золотое шитьё: пышные растительные завитки по тёмному сукну. Калмыцкий орнамент: буддийские мотивы, меандр.',
    color:    '#f4a0a0',
    tags:     ['Растительный завиток', 'Золотое шитьё', 'Меандр'],
  },
  ncfd: {
    name:     'Северо-Кавказский ФО',
    people:   'Чеченцы, Дагестанцы, Осетины',
    ornament: 'Рог барана · Кайтагская вышивка Дагестана',
    desc:     'Кайтагская вышивка: абстрактные символы мира духов. Двойной рог барана — символ мужества. Строгая геометрия с линиями-оберегами.',
    color:    '#b07ab8',
    tags:     ['Рог барана', 'S-мотив', 'Кайтагская вышивка'],
  },
  volga: {
    name:     'Приволжский ФО',
    people:   'Татары, Башкиры, Чуваши, Марийцы',
    ornament: 'Тюльпан · Татарский орнамент',
    desc:     'Татарский орнамент: тюльпан и гвоздика (влияние ислама — без людей и животных). Башкирский: тамга рода. Марийский: «паспорт» рода.',
    color:    '#4cbe30',
    tags:     ['Тюльпан', 'Тамга рода', 'Исламский канон'],
  },
  ural: {
    name:     'Уральский ФО',
    people:   'Ханты, Манси, Ненцы, Башкиры',
    ornament: 'Нёр-ях · Хантыйский меховой узор',
    desc:     'Хантыйский орнамент «нёр-ях»: полосы-«дороги» и ромб жизни на меховой одежде. Родовой код, передаётся от матери к дочери.',
    color:    '#b8b888',
    tags:     ['Нёр-ях', 'Ромб жизни', 'Родовой код'],
  },
  siberia: {
    name:     'Сибирский ФО',
    people:   'Буряты, Алтайцы, Тувинцы, Хакасы',
    ornament: 'Бесконечный узел · Бурятский орнамент',
    desc:     'Бурятский орнамент: «бесконечный узел» (вечность, буддизм) плюс рог барана. Тувинский «ак-кем» — горная волна. Золото и синий.',
    color:    '#38b8e8',
    tags:     ['Бесконечный узел', 'Рог барана', 'Буддийский мотив'],
  },
  fareast: {
    name:     'Дальневосточный ФО',
    people:   'Якуты (Саха), Эвенки, Нанайцы, Чукчи',
    ornament: 'Лировидный узор · Якутская аппликация',
    desc:     'Якутский орнамент: лировидный узор — Древо жизни, аппликация на бересте и меху. Нанайский: спираль-«амба» (тигр). Шаманская символика.',
    color:    '#f0c030',
    tags:     ['Лировидный узор', 'Древо жизни', 'Шаманский оберег'],
  },
};

/**
 * Colour → district id mapping (from original SVG fill colours)
 */
export const COLOR_TO_DISTRICT = {
  'f5f07a': 'central',
  '62d2c5': 'northwest',
  'f4a0a0': 'south',
  'b07ab8': 'ncfd',
  '4cbe30': 'volga',
  'b8b888': 'ural',
  '38b8e8': 'siberia',
  'f0c030': 'fareast',
};
