/* Cleared, synthetic fixtures for the browser prototype. No Google IDs or secrets. */
window.LOCAL_LORE_FIXTURES = {
  cities: {
    toronto: {
      id: 'toronto', name: 'Toronto', defaultRadius: 3, coverage: '9 sample rounds across three modes.', regions: '6 districts', center: 'Downtown Toronto',
      radiusHints: {
        1: 'A tight circle around downtown Toronto. Familiar places, fewer surprises.',
        3: 'The demo uses a fixed 3 km example scope. Live location search is not available yet.',
        5: 'A wider Toronto loop with more cross-neighborhood connections.',
        10: 'A city-scale challenge with more ordinary streets and fewer obvious clues.'
      },
      mapLabels: ['Queen St W', 'Bathurst St', 'College St', 'Dundas St W']
    }
  },
  modes: {
    daily: {
      label: 'Daily Three', eyebrow: 'DAILY THREE', description: 'Three sample rounds · replay anytime', untimed: false, clues: false, answerLabel: 'Name the cross streets',
      rounds: [
        {
          id: 'daily-queen-spadina', category: 'INTERSECTION', answerType: 'unordered pair', prompt: 'Name the cross streets', instruction: 'Use the scene to identify the target shown. Your answer is the intersection, not the camera position.', placeholder: 'e.g. Queen St W & Spadina Ave', answer: 'Queen St W × Spadina Ave',
          accepted: ['queen st w & spadina ave', 'queen street west & spadina avenue', 'spadina ave & queen st w', 'spadina avenue & queen street west'],
          catalog: [['Queen St W × Spadina Ave', 'Downtown · intersection'], ['Queen St W × Bathurst St', 'West downtown · intersection'], ['King St W × Strachan Ave', 'West downtown · intersection'], ['Dundas St W × Ossington Ave', 'West end · intersection'], ['College St × Spadina Ave', 'The Annex · intersection']],
          image: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1600&q=88', imagePosition: 'center 58%', targetPin: { x: 62, y: 43 },
          note: 'Spadina runs north–south through the city and meets Queen in the heart of the west downtown grid.', clue: 'This corner sits on a north–south avenue known for its wide right-of-way and streetcars.', nearMiss: ['queen']
        },
        {
          id: 'daily-king-bathurst', category: 'INTERSECTION', answerType: 'unordered pair', prompt: 'Name the cross streets', instruction: 'Look for the relationship between the main road and the quieter north–south route.', placeholder: 'e.g. King St W & Bathurst St', answer: 'King St W × Bathurst St',
          accepted: ['king st w & bathurst st', 'king street west & bathurst street', 'bathurst st & king st w', 'bathurst street & king street west'],
          catalog: [['King St W × Bathurst St', 'West downtown · intersection'], ['King St W × Strachan Ave', 'West downtown · intersection'], ['Queen St W × Bathurst St', 'West downtown · intersection'], ['Dundas St W × Bathurst St', 'West end · intersection'], ['Bloor St W × Bathurst St', 'The Annex · intersection']],
          image: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1600&q=88', imagePosition: 'center 52%', targetPin: { x: 40, y: 62 },
          note: 'Bathurst is a useful mental spine: it connects the Annex to the waterfront while King carries the westbound streetcar line.', clue: 'The target is west of the downtown core, where a streetcar corridor meets a north–south street.', nearMiss: ['king']
        },
        {
          id: 'daily-dundas-ossington', category: 'INTERSECTION', answerType: 'unordered pair', prompt: 'Name the cross streets', instruction: 'Take in the whole junction. Street order never matters for an intersection answer.', placeholder: 'e.g. Dundas St W & Ossington Ave', answer: 'Dundas St W × Ossington Ave',
          accepted: ['dundas st w & ossington ave', 'dundas street west & ossington avenue', 'ossington ave & dundas st w', 'ossington avenue & dundas street west'],
          catalog: [['Dundas St W × Ossington Ave', 'West end · intersection'], ['Dundas St W × Bathurst St', 'West end · intersection'], ['Queen St W × Ossington Ave', 'West end · intersection'], ['College St × Ossington Ave', 'West end · intersection'], ['King St W × Strachan Ave', 'West downtown · intersection']],
          image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1600&q=88', imagePosition: 'center 45%', targetPin: { x: 74, y: 65 },
          note: 'Ossington is one of the city’s strong north–south connectors. Dundas turns this point into a useful west-end anchor.', clue: 'You are looking at a west-end junction where a diagonal-feeling east–west road meets a long avenue.', nearMiss: ['dundas']
        }
      ]
    },
    around: {
      label: 'Around Here', eyebrow: 'AROUND HERE', description: 'Untimed practice · use a clue', untimed: true, clues: true, answerLabel: 'Name the cross streets',
      rounds: [
        {
          id: 'around-bloor-bathurst', category: 'INTERSECTION', answerType: 'unordered pair', prompt: 'Name the cross streets', instruction: 'Practice is untimed. Use the scene and your local memory, then commit when ready.', placeholder: 'e.g. Bloor St W & Bathurst St', answer: 'Bloor St W × Bathurst St',
          accepted: ['bloor st w & bathurst st', 'bloor street west & bathurst street', 'bathurst st & bloor st w', 'bathurst street & bloor street west'],
          catalog: [['Bloor St W × Bathurst St', 'The Annex · intersection'], ['College St × Spadina Ave', 'The Annex · intersection'], ['Dundas St W × Bathurst St', 'West end · intersection'], ['Queen St W × Spadina Ave', 'Downtown · intersection'], ['Yonge St × Bloor St', 'Yorkville · intersection']],
          image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1600&q=88', imagePosition: 'center 50%', targetPin: { x: 33, y: 40 },
          note: 'Bloor and Bathurst make a clean cross-town connection: the subway runs below Bloor while Bathurst heads toward the waterfront.', clue: 'Think university, subway, and one of the city’s oldest north–south streets.', nearMiss: ['bloor']
        },
        {
          id: 'around-college-spadina', category: 'INTERSECTION', answerType: 'unordered pair', prompt: 'Name the cross streets', instruction: 'The answer is the target shown, not the place where the picture was captured.', placeholder: 'e.g. College St & Spadina Ave', answer: 'College St × Spadina Ave',
          accepted: ['college st & spadina ave', 'college street & spadina avenue', 'spadina ave & college st', 'spadina avenue & college street'],
          catalog: [['College St × Spadina Ave', 'The Annex · intersection'], ['Queen St W × Spadina Ave', 'Downtown · intersection'], ['Bloor St W × Bathurst St', 'The Annex · intersection'], ['Dundas St W × Ossington Ave', 'West end · intersection'], ['College St × Ossington Ave', 'West end · intersection']],
          image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=88', imagePosition: 'center 62%', targetPin: { x: 57, y: 33 },
          note: 'College is the slower east–west companion to Bloor. Spadina gives it a direct route toward Chinatown and the lake.', clue: 'The target is north of Queen and south of Bloor, along a street that passes the university district.', nearMiss: ['college']
        },
        {
          id: 'around-yonge-bloor', category: 'INTERSECTION', answerType: 'unordered pair', prompt: 'Name the cross streets', instruction: 'Use the visible geometry first, then use the answer catalog to confirm the street pair.', placeholder: 'e.g. Yonge St & Bloor St', answer: 'Yonge St × Bloor St',
          accepted: ['yonge st & bloor st', 'yonge street & bloor street', 'bloor st & yonge st', 'bloor street & yonge street'],
          catalog: [['Yonge St × Bloor St', 'Yorkville · intersection'], ['Yonge St × Dundas St', 'Downtown · intersection'], ['Bloor St W × Bathurst St', 'The Annex · intersection'], ['College St × Spadina Ave', 'The Annex · intersection'], ['King St W × Bathurst St', 'West downtown · intersection']],
          image: 'https://images.unsplash.com/photo-1514924013411-cbf25faa35bb?auto=format&fit=crop&w=1600&q=88', imagePosition: 'center 48%', targetPin: { x: 78, y: 36 },
          note: 'Yonge is the city’s main north–south reference line. Bloor gives you a quick mental crossbar across Toronto.', clue: 'This is one of the most recognizable cross-town intersections in the city.', nearMiss: ['yonge']
        }
      ]
    },
    landmark: {
      label: 'Landmark Lines', eyebrow: 'LANDMARK LINES', description: 'Recognizable places · name the street', untimed: true, clues: true, answerLabel: 'Which street is this building on?',
      rounds: [
        {
          id: 'landmark-royal-york', category: 'PUBLIC BUILDING', answerType: 'street identity', prompt: 'Which street is this building on?', instruction: 'Name the public street shown by the building entrance. Do not include a unit or suite number.', placeholder: 'e.g. Front Street West', answer: 'Front Street West',
          accepted: ['front street west', 'front st w', 'front street w'],
          catalog: [['Front Street West', 'Downtown · street'], ['Yonge Street', 'Downtown · street'], ['Bay Street', 'Downtown · street'], ['King Street West', 'West downtown · street'], ['University Avenue', 'Downtown · street']],
          image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=88', imagePosition: 'center 48%', targetPin: { x: 47, y: 57 },
          note: 'Front Street traces the older edge of downtown and connects Union Station to the St. Lawrence neighbourhood.', clue: 'This building is beside the rail corridor and close to the waterfront-facing side of downtown.', nearMiss: ['front']
        },
        {
          id: 'landmark-reference-library', category: 'PUBLIC BUILDING', answerType: 'street identity', prompt: 'Which street is this building on?', instruction: 'Choose the main public street associated with the building, not the nearest cross street.', placeholder: 'e.g. Yonge Street', answer: 'Yonge Street',
          accepted: ['yonge street', 'yonge st'],
          catalog: [['Yonge Street', 'Yorkville · street'], ['Bloor Street West', 'The Annex · street'], ['Bay Street', 'Downtown · street'], ['Front Street West', 'Downtown · street'], ['College Street', 'The Annex · street']],
          image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=88', imagePosition: 'center 42%', targetPin: { x: 68, y: 40 },
          note: 'Yonge is the city’s reference meridian and one of the most useful streets to remember when building a local mental map.', clue: 'Look for a civic building in the Yorkville–Bloor area on Toronto’s main north–south street.', nearMiss: ['yonge']
        },
        {
          id: 'landmark-market', category: 'PUBLIC MARKET', answerType: 'street identity', prompt: 'Which street is this building on?', instruction: 'Use the facade and surrounding block shape to place this public market on the city grid.', placeholder: 'e.g. Front Street East', answer: 'Front Street East',
          accepted: ['front street east', 'front st e', 'front street e'],
          catalog: [['Front Street East', 'Old Town · street'], ['Church Street', 'Old Town · street'], ['King Street East', 'Old Town · street'], ['Yonge Street', 'Downtown · street'], ['Queen Street East', 'East downtown · street']],
          image: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&w=1600&q=88', imagePosition: 'center 57%', targetPin: { x: 39, y: 69 },
          note: 'Front Street East keeps the market district tied to the older downtown grid and the waterfront direction.', clue: 'Think Old Town, a public market, and the eastward continuation of the downtown waterfront edge.', nearMiss: ['front']
        }
      ]
    }
  },
  leaderboard: [
    ['MapleMara', '2,960'], ['northstar', '2,910'], ['citywalker', '2,860'], ['Mina on foot', '2,790'], ['streetlevel', '2,740'], ['Crosstown', '2,690'], ['tramline', '2,620'], ['westbound', '2,580'], ['gridkeeper', '2,550'], ['Alex R.', '2,510'], ['Maple Leaf', '2,490'], ['junctions', '2,470'], ['you · demo', '2,420'], ['Harbourlight', '2,410'], ['Northbound', '2,390']
  ],
  notes: [
    { id: 'note-spadina', title: 'Spadina × Queen', relation: 'Wide north–south avenue meets the west downtown grid.', state: 'noticed', due: 'Review in 3 days', category: 'intersection' },
    { id: 'note-bathurst', title: 'Bathurst spine', relation: 'A north–south reference between the Annex and the waterfront.', state: 'unseen', due: 'Play to notice', category: 'street relationship' },
    { id: 'note-front', title: 'Front Street edge', relation: 'The older downtown edge sits between Union and the market district.', state: 'unseen', due: 'Play to notice', category: 'landmark line' }
  ]
};
