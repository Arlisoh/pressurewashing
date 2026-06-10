export const LOCATIONS = [
  { city: 'Cincinnati', county: 'Hamilton County', neighborhoods: ['Hyde Park', 'Oakley', 'Mount Lookout', 'Clifton', 'Northside', 'Over-the-Rhine', 'Columbia Tusculum', 'Madisonville', 'Westwood', 'College Hill', 'Mount Washington', 'Anderson Township'] },
  { city: 'Fairfield', county: 'Butler County', neighborhoods: ['Fairfield South', 'Pleasant Run Farm', 'Rolling Hills', 'Village Green', 'Fairfield Township', 'Winton Woods area'] },
  { city: 'Hamilton', county: 'Butler County', neighborhoods: ['German Village', 'Lindenwald', 'Rossville', 'Highland Park', 'West Side Hamilton', 'Downtown Hamilton'] },
  { city: 'West Chester', county: 'Butler County', neighborhoods: ['Beckett Ridge', 'Tylersville corridor', 'Union Centre', 'Olde West Chester', 'Wetherington', 'Lakota Hills'] },
  { city: 'Mason', county: 'Warren County', neighborhoods: ['Deerfield Township', 'Kings Island area', 'Mason Montgomery corridor', 'Heritage Club area', 'Downtown Mason'] },
  { city: 'Lebanon', county: 'Warren County', neighborhoods: ['Downtown Lebanon', 'Turtlecreek Township', 'Shaker Run area', 'Countryside subdivisions'] },
  { city: 'Middletown', county: 'Butler County', neighborhoods: ['Central Avenue corridor', 'Rosedale', 'Mayfield', 'Manchester Manor', 'Yankee Road area'] },
  { city: 'Springboro', county: 'Warren County', neighborhoods: ['Settlers Walk', 'Heatherwoode', 'Five Points', 'Historic Springboro', 'Clearcreek Township'] },
  { city: 'Dayton', county: 'Montgomery County', neighborhoods: ['Oakwood', 'Kettering', 'Centerville', 'Beavercreek', 'Miamisburg', 'Washington Township'] },
  { city: 'Loveland', county: 'Hamilton/Clermont/Warren County', neighborhoods: ['Historic Loveland', 'Symmes Township', 'Miami Township', 'Landen', 'Loveland Madeira corridor'] },
  { city: 'Milford', county: 'Clermont County', neighborhoods: ['Old Milford', 'Miami Township', 'Day Heights', 'Mulberry', 'Terrace Park area'] },
  { city: 'Blue Ash', county: 'Hamilton County', neighborhoods: ['Kenwood area', 'Summit Park area', 'Hunt Road corridor', 'Sycamore Township'] },
  { city: 'Sharonville', county: 'Hamilton/Butler County', neighborhoods: ['Northern Lights', 'Crescentville', 'Reading Road corridor', 'Sharon Woods area'] },
  { city: 'Oxford', county: 'Butler County', neighborhoods: ['Mile Square', 'Miami University area', 'Uptown Oxford', 'Tollgate', 'College Corner area'] },
  { city: 'Trenton', county: 'Butler County', neighborhoods: ['Edgewood area', 'Wayne Madison corridor', 'Bloomfield Hills area', 'Downtown Trenton'] },
  { city: 'Monroe', county: 'Butler/Warren County', neighborhoods: ['Liberty Township edge', 'Monroe Crossings', 'Todhunter Road area', 'Heritage Green'] },
  { city: 'Liberty Township', county: 'Butler County', neighborhoods: ['Four Bridges', 'Carriage Hill', 'Bethany', 'Yankee Road corridor', 'Lakota East area'] },
  { city: 'Evendale', county: 'Hamilton County', neighborhoods: ['Reading Road corridor', 'Giverny area', 'Glendale edge', 'Woodlawn edge'] },
  { city: 'Norwood', county: 'Hamilton County', neighborhoods: ['Presidential District', 'Factory 52 area', 'Williams Avenue area', 'Surrey Square area'] },
  { city: 'Florence', county: 'Boone County', neighborhoods: ['Mall Road corridor', 'Oakbrook', 'Union edge', 'Turfway area'] },
  { city: 'Covington', county: 'Kenton County', neighborhoods: ['MainStrasse', 'Wallace Woods', 'Latonia', 'Austinburg', 'Riverside Drive area'] },
  { city: 'Newport', county: 'Campbell County', neighborhoods: ['East Row', 'Newport on the Levee area', 'The Ovation area', 'South Newport'] }
];

export const TOPICS = [
  'driveway pressure washing after winter salt and grime',
  'concrete cleaning for patios, sidewalks, and front walkways',
  'pool deck cleaning before summer gatherings',
  'house soft washing for siding, trim, and exterior algae',
  'commercial storefront exterior cleaning',
  'HOA-friendly curb appeal cleaning before listing a home',
  'deck and fence cleaning without damaging wood surfaces',
  'spring exterior cleaning checklist for homeowners',
  'fall exterior cleaning before leaves and moisture build up',
  'why black streaks and green algae return on shaded surfaces',
  'pre-party patio cleaning for graduation parties and cookouts',
  'pressure washing safety for older concrete and pavers',
  'pre-sale curb appeal cleaning for real estate listings',
  'restaurant patio and sidewalk cleaning',
  'office and retail entryway cleaning for first impressions'
];

export function pickTarget(existingPosts = []) {
  const usedCombos = new Set(existingPosts.slice(0, 200).map((post) => `${post.city}|${post.neighborhood}|${post.topic}`));
  const hourSeed = Math.floor(Date.now() / 3600000);
  for (let offset = 0; offset < LOCATIONS.length * TOPICS.length * 3; offset += 1) {
    const cityIndex = (hourSeed + offset * 7) % LOCATIONS.length;
    const location = LOCATIONS[cityIndex];
    const neighborhoodIndex = (hourSeed + offset * 11) % location.neighborhoods.length;
    const topicIndex = (hourSeed + offset * 13) % TOPICS.length;
    const neighborhood = location.neighborhoods[neighborhoodIndex];
    const topic = TOPICS[topicIndex];
    const key = `${location.city}|${neighborhood}|${topic}`;
    if (!usedCombos.has(key)) {
      return { ...location, neighborhood, topic };
    }
  }
  const location = LOCATIONS[hourSeed % LOCATIONS.length];
  return {
    ...location,
    neighborhood: location.neighborhoods[hourSeed % location.neighborhoods.length],
    topic: TOPICS[hourSeed % TOPICS.length]
  };
}
