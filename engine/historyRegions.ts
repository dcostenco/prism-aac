/**
 * History — sub-national region data for the math History keyboard.
 *
 * Many countries have meaningful state / province / Land / region
 * curricula that diverge from the national tier. A child in Texas
 * studies the Alamo, in Quebec the Plains of Abraham, in Bavaria the
 * Wittelsbachs, in Catalonia 1714 — none of which surface on a
 * generic English/French/German/Spanish keyboard.
 *
 * Region keys follow ISO 3166-2 where possible (`US-TX`, `CA-QC`,
 * `DE-BY`, `IN-TN`); UK uses `UK-ENG | UK-SCT | UK-WLS | UK-NIR`,
 * and Ireland adds a `IE-PROV-*` series for the four historical
 * provinces (Leinster / Munster / Connacht / Ulster) on top of the
 * Republic-wide `IE` slot.
 *
 * The MathHistoryKeyboard renders WORLD ∪ NATIONAL ∪ REGIONAL when
 * `useSettingsStore.historyRegion` is set. Each entry is at most 4
 * events to keep the keyboard surface-area sane; periods can be
 * added per region in REGIONAL_PERIODS_BY_REGION when a region's
 * curriculum splits from the national one.
 *
 * Adding a region: append to REGIONAL_EVENTS_BY_REGION with a stable
 * ISO key + 3-4 events your local curriculum considers canonical.
 * Pull requests welcome — content data, not security-sensitive code.
 */

export interface HistoryGlyph {
  glyph: string;
  label: string;
}

/* ── United States — 50 states + DC ───────────────────────────── */

export const US_STATE_EVENTS: Record<string, HistoryGlyph[]> = {
  'US-AL': [{ glyph: '1819', label: 'alabama statehood' }, { glyph: '1965', label: 'selma march' }],
  'US-AK': [{ glyph: '1867', label: 'alaska purchase' }, { glyph: '1959', label: 'alaska statehood' }],
  'US-AZ': [{ glyph: '1912', label: 'arizona statehood' }, { glyph: '1881', label: 'tombstone shootout' }],
  'US-AR': [{ glyph: '1836', label: 'arkansas statehood' }, { glyph: '1957', label: 'little rock nine' }],
  'US-CA': [{ glyph: '1849', label: 'california gold rush' }, { glyph: '1850', label: 'california statehood' }, { glyph: '1906', label: 'sf earthquake' }],
  'US-CO': [{ glyph: '1858', label: 'colorado gold rush' }, { glyph: '1876', label: 'colorado statehood' }],
  'US-CT': [{ glyph: '1639', label: 'fundamental orders' }, { glyph: '1788', label: 'connecticut ratifies' }],
  'US-DE': [{ glyph: '1638', label: 'new sweden' }, { glyph: '1787', label: 'first state ratifies' }],
  'US-FL': [{ glyph: '1513', label: 'ponce de leon' }, { glyph: '1845', label: 'florida statehood' }, { glyph: '1969', label: 'apollo 11 launch' }],
  'US-GA': [{ glyph: '1733', label: 'oglethorpe colony' }, { glyph: '1864', label: 'sherman march' }],
  'US-HI': [{ glyph: '1810', label: 'kamehameha unification' }, { glyph: '1898', label: 'hawaii annexation' }, { glyph: '1959', label: 'hawaii statehood' }],
  'US-ID': [{ glyph: '1805', label: 'lewis and clark' }, { glyph: '1890', label: 'idaho statehood' }],
  'US-IL': [{ glyph: '1818', label: 'illinois statehood' }, { glyph: '1871', label: 'great chicago fire' }],
  'US-IN': [{ glyph: '1816', label: 'indiana statehood' }, { glyph: '1811', label: 'tippecanoe' }],
  'US-IA': [{ glyph: '1846', label: 'iowa statehood' }, { glyph: '1838', label: 'iowa territory' }],
  'US-KS': [{ glyph: '1854', label: 'kansas nebraska act' }, { glyph: '1861', label: 'kansas statehood' }, { glyph: '1954', label: 'brown v board' }],
  'US-KY': [{ glyph: '1792', label: 'kentucky statehood' }, { glyph: '1809', label: 'lincoln born' }],
  'US-LA': [{ glyph: '1803', label: 'louisiana purchase' }, { glyph: '1815', label: 'battle of new orleans' }, { glyph: '2005', label: 'katrina' }],
  'US-ME': [{ glyph: '1820', label: 'maine statehood' }, { glyph: '1607', label: 'popham colony' }],
  'US-MD': [{ glyph: '1634', label: 'maryland founded' }, { glyph: '1814', label: 'fort mchenry' }],
  'US-MA': [{ glyph: '1620', label: 'mayflower pilgrims' }, { glyph: '1773', label: 'boston tea party' }, { glyph: '1775', label: 'lexington concord' }],
  'US-MI': [{ glyph: '1837', label: 'michigan statehood' }, { glyph: '1908', label: 'ford model t' }],
  'US-MN': [{ glyph: '1858', label: 'minnesota statehood' }, { glyph: '1862', label: 'dakota war' }],
  'US-MS': [{ glyph: '1817', label: 'mississippi statehood' }, { glyph: '1962', label: 'ole miss desegregation' }],
  'US-MO': [{ glyph: '1820', label: 'missouri compromise' }, { glyph: '1821', label: 'missouri statehood' }, { glyph: '1857', label: 'dred scott' }],
  'US-MT': [{ glyph: '1876', label: 'little bighorn' }, { glyph: '1889', label: 'montana statehood' }],
  'US-NE': [{ glyph: '1854', label: 'kansas nebraska act-ne' }, { glyph: '1867', label: 'nebraska statehood' }],
  'US-NV': [{ glyph: '1859', label: 'comstock lode' }, { glyph: '1864', label: 'nevada statehood' }],
  'US-NH': [{ glyph: '1788', label: 'nh ratifies' }, { glyph: '1623', label: 'new hampshire founded' }],
  'US-NJ': [{ glyph: '1664', label: 'new jersey colony' }, { glyph: '1787', label: 'nj ratifies' }],
  'US-NM': [{ glyph: '1598', label: 'spanish nm settlement' }, { glyph: '1912', label: 'nm statehood' }, { glyph: '1945', label: 'trinity test' }],
  'US-NY': [{ glyph: '1624', label: 'new amsterdam' }, { glyph: '1825', label: 'erie canal' }, { glyph: '1886', label: 'statue of liberty' }, { glyph: '2001', label: 'sept 11' }],
  'US-NC': [{ glyph: '1587', label: 'roanoke colony' }, { glyph: '1903', label: 'wright brothers' }],
  'US-ND': [{ glyph: '1804', label: 'lewis clark winter' }, { glyph: '1889', label: 'nd statehood' }],
  'US-OH': [{ glyph: '1803', label: 'ohio statehood' }, { glyph: '1969', label: 'cuyahoga river fire' }],
  'US-OK': [{ glyph: '1838', label: 'trail of tears' }, { glyph: '1907', label: 'oklahoma statehood' }, { glyph: '1995', label: 'okc bombing' }],
  'US-OR': [{ glyph: '1843', label: 'oregon trail' }, { glyph: '1859', label: 'oregon statehood' }],
  'US-PA': [{ glyph: '1681', label: 'pennsylvania charter' }, { glyph: '1787', label: 'constitution signed' }, { glyph: '1863', label: 'gettysburg' }],
  'US-RI': [{ glyph: '1636', label: 'rhode island founded' }, { glyph: '1790', label: 'ri ratifies last' }],
  'US-SC': [{ glyph: '1670', label: 'charleston founded' }, { glyph: '1860', label: 'sc secession' }, { glyph: '1861', label: 'fort sumter' }],
  'US-SD': [{ glyph: '1874', label: 'black hills gold' }, { glyph: '1890', label: 'wounded knee' }],
  'US-TN': [{ glyph: '1796', label: 'tennessee statehood' }, { glyph: '1925', label: 'scopes trial' }],
  'US-TX': [{ glyph: '1836', label: 'alamo + texas indep' }, { glyph: '1845', label: 'texas annexation' }, { glyph: '1963', label: 'jfk assassination' }],
  'US-UT': [{ glyph: '1847', label: 'mormon arrival' }, { glyph: '1896', label: 'utah statehood' }],
  'US-VT': [{ glyph: '1777', label: 'vermont republic' }, { glyph: '1791', label: 'vermont statehood' }],
  'US-VA': [{ glyph: '1607', label: 'jamestown' }, { glyph: '1619', label: 'first africans virginia' }, { glyph: '1781', label: 'yorktown' }],
  'US-WA': [{ glyph: '1889', label: 'washington statehood' }, { glyph: '1980', label: 'mt st helens' }],
  'US-WV': [{ glyph: '1859', label: 'harpers ferry raid' }, { glyph: '1863', label: 'wv statehood' }],
  'US-WI': [{ glyph: '1848', label: 'wisconsin statehood' }, { glyph: '1854', label: 'republican party founded' }],
  'US-WY': [{ glyph: '1869', label: 'wyoming womens suffrage' }, { glyph: '1890', label: 'wyoming statehood' }],
  'US-DC': [{ glyph: '1790', label: 'dc residence act' }, { glyph: '1814', label: 'burning of washington' }, { glyph: '1963', label: 'march on washington' }],
};

/* ── Canada — 10 provinces + 3 territories ───────────────────── */

export const CA_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'CA-ON': [{ glyph: '1784', label: 'loyalist arrival' }, { glyph: '1812', label: 'war of 1812' }, { glyph: '1867', label: 'confederation-on' }],
  'CA-QC': [{ glyph: '1608', label: 'quebec city founded' }, { glyph: '1759', label: 'plains of abraham' }, { glyph: '1960', label: 'quiet revolution' }, { glyph: '1995', label: 'quebec referendum' }],
  'CA-NS': [{ glyph: '1605', label: 'port royal' }, { glyph: '1755', label: 'acadian deportation' }, { glyph: '1917', label: 'halifax explosion' }],
  'CA-NB': [{ glyph: '1604', label: 'st croix island' }, { glyph: '1784', label: 'nb province' }],
  'CA-MB': [{ glyph: '1869', label: 'red river resistance' }, { glyph: '1870', label: 'manitoba act' }, { glyph: '1919', label: 'winnipeg general strike' }],
  'CA-BC': [{ glyph: '1858', label: 'fraser gold rush' }, { glyph: '1871', label: 'bc joins canada' }, { glyph: '1885', label: 'last spike' }],
  'CA-PE': [{ glyph: '1864', label: 'charlottetown conference' }, { glyph: '1873', label: 'pei joins canada' }],
  'CA-SK': [{ glyph: '1885', label: 'northwest rebellion' }, { glyph: '1905', label: 'saskatchewan province' }],
  'CA-AB': [{ glyph: '1905', label: 'alberta province' }, { glyph: '1947', label: 'leduc oil discovery' }],
  'CA-NL': [{ glyph: '1583', label: 'newfoundland claimed' }, { glyph: '1949', label: 'nl joins canada' }],
  'CA-YT': [{ glyph: '1896', label: 'klondike gold rush' }, { glyph: '1898', label: 'yukon territory' }],
  'CA-NT': [{ glyph: '1870', label: 'rupert land transfer' }],
  'CA-NU': [{ glyph: '1999', label: 'nunavut territory' }],
};

/* ── United Kingdom — 4 nations ──────────────────────────────── */

export const UK_NATION_EVENTS: Record<string, HistoryGlyph[]> = {
  'UK-ENG': [{ glyph: '1066', label: 'norman conquest-eng' }, { glyph: '1215', label: 'magna carta-eng' }, { glyph: '1485', label: 'tudor dynasty' }, { glyph: '1688', label: 'glorious revolution' }],
  'UK-SCT': [{ glyph: '1314', label: 'bannockburn' }, { glyph: '1707', label: 'acts of union' }, { glyph: '1746', label: 'culloden' }, { glyph: '1999', label: 'scottish parliament' }, { glyph: '2014', label: 'scottish referendum' }],
  'UK-WLS': [{ glyph: '1282', label: 'edward i conquest wales' }, { glyph: '1400', label: 'glyndwr rebellion' }, { glyph: '1536', label: 'wales act of union' }, { glyph: '1999', label: 'welsh assembly' }],
  'UK-NIR': [{ glyph: '1607', label: 'flight of the earls' }, { glyph: '1690', label: 'battle of the boyne' }, { glyph: '1921', label: 'ireland partition' }, { glyph: '1969', label: 'troubles begin' }, { glyph: '1998', label: 'good friday agreement' }],
};

/* ── Ireland — Republic + 4 historical provinces ─────────────── */

export const IE_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'IE': [{ glyph: '1916', label: 'easter rising' }, { glyph: '1919', label: 'irish independence war' }, { glyph: '1922', label: 'irish free state' }, { glyph: '1937', label: 'irish constitution' }, { glyph: '1973', label: 'ireland eu' }],
  'IE-LEN': [{ glyph: '1170', label: 'norman invasion leinster' }, { glyph: '1592', label: 'trinity college dublin' }, { glyph: '1916', label: 'rising dublin' }],
  'IE-MUN': [{ glyph: '1601', label: 'kinsale battle' }, { glyph: '1690', label: 'siege of limerick' }, { glyph: '1845', label: 'great famine start' }],
  'IE-CON': [{ glyph: '1235', label: 'norman conquest connacht' }, { glyph: '1235', label: 'galway founded' }, { glyph: '1879', label: 'land league' }],
  'IE-ULS': [{ glyph: '1607', label: 'flight earls ulster' }, { glyph: '1798', label: 'united irishmen' }, { glyph: '1920', label: 'ulster government' }],
};

/* ── Australia — 6 states + 2 territories ────────────────────── */

export const AU_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'AU-NSW': [{ glyph: '1788', label: 'first fleet' }, { glyph: '1851', label: 'nsw gold rush' }, { glyph: '1932', label: 'sydney harbour bridge' }],
  'AU-VIC': [{ glyph: '1835', label: 'melbourne founded' }, { glyph: '1854', label: 'eureka stockade' }, { glyph: '1956', label: 'melbourne olympics' }],
  'AU-QLD': [{ glyph: '1859', label: 'queensland separation' }, { glyph: '1867', label: 'gympie gold' }],
  'AU-WA': [{ glyph: '1829', label: 'swan river colony' }, { glyph: '1893', label: 'kalgoorlie gold' }],
  'AU-SA': [{ glyph: '1836', label: 'sa colony' }, { glyph: '1894', label: 'sa womens suffrage' }],
  'AU-TAS': [{ glyph: '1803', label: 'tasmania settlement' }, { glyph: '1856', label: 'tasmania self govt' }],
  'AU-ACT': [{ glyph: '1911', label: 'act established' }, { glyph: '1927', label: 'parliament canberra' }],
  'AU-NT': [{ glyph: '1869', label: 'darwin founded' }, { glyph: '1942', label: 'darwin bombing' }],
};

/* ── Germany — 16 Länder ─────────────────────────────────────── */

export const DE_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'DE-BW': [{ glyph: '1819', label: 'baden constitution' }, { glyph: '1952', label: 'bw founded' }],
  'DE-BY': [{ glyph: '1180', label: 'wittelsbach' }, { glyph: '1806', label: 'kingdom of bavaria' }, { glyph: '1918', label: 'bavarian republic' }],
  'DE-BE': [{ glyph: '1237', label: 'berlin founded' }, { glyph: '1961', label: 'berlin wall' }, { glyph: '1989', label: 'wall fall' }],
  'DE-BB': [{ glyph: '1417', label: 'hohenzollern brandenburg' }, { glyph: '1701', label: 'kingdom of prussia' }],
  'DE-HB': [{ glyph: '1186', label: 'free hansestadt bremen' }, { glyph: '1945', label: 'bremen us zone' }],
  'DE-HH': [{ glyph: '1241', label: 'hanseatic league' }, { glyph: '1842', label: 'great fire hamburg' }],
  'DE-HE': [{ glyph: '1837', label: 'gottingen seven' }, { glyph: '1848', label: 'frankfurt parliament' }],
  'DE-MV': [{ glyph: '1419', label: 'rostock university' }, { glyph: '1990', label: 'mv reformed' }],
  'DE-NI': [{ glyph: '1714', label: 'hanover personal union' }, { glyph: '1837', label: 'hanover separation' }],
  'DE-NW': [{ glyph: '1815', label: 'rhine province prussia' }, { glyph: '1946', label: 'nrw founded' }],
  'DE-RP': [{ glyph: '1946', label: 'rheinland-pfalz founded' }],
  'DE-SL': [{ glyph: '1919', label: 'saar mandate' }, { glyph: '1957', label: 'saar joins frg' }],
  'DE-SN': [{ glyph: '1485', label: 'saxon partition' }, { glyph: '1989', label: 'leipzig demonstrations' }],
  'DE-ST': [{ glyph: '1517', label: 'wittenberg theses' }, { glyph: '1990', label: 'sa reunification' }],
  'DE-SH': [{ glyph: '1864', label: 'second schleswig war' }, { glyph: '1945', label: 'sh british zone' }],
  'DE-TH': [{ glyph: '1485', label: 'thuringia partition' }, { glyph: '1919', label: 'weimar in thuringia' }],
};

/* ── France — 13 metropolitan regions ────────────────────────── */

export const FR_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'FR-IDF': [{ glyph: '987', label: 'capet paris' }, { glyph: '1789', label: 'storming bastille' }, { glyph: '1871', label: 'paris commune' }],
  'FR-BRE': [{ glyph: '1532', label: 'brittany annexation' }, { glyph: '845', label: 'nominoe brittany' }],
  'FR-NOR': [{ glyph: '911', label: 'rollo treaty' }, { glyph: '1204', label: 'normandy lost' }, { glyph: '1944', label: 'd day' }],
  'FR-OCC': [{ glyph: '1209', label: 'albigensian crusade' }, { glyph: '1271', label: 'toulouse french' }],
  'FR-NAQ': [{ glyph: '1453', label: 'aquitaine reconquest' }, { glyph: '1635', label: 'bordeaux uprising' }],
  'FR-PDL': [{ glyph: '1532', label: 'pdl edict' }, { glyph: '1793', label: 'vendee uprising' }],
  'FR-CVL': [{ glyph: '1429', label: 'orleans siege lifted' }, { glyph: '1598', label: 'edict of nantes' }],
  'FR-BFC': [{ glyph: '1477', label: 'burgundy french' }, { glyph: '1678', label: 'franche-comte french' }],
  'FR-ARA': [{ glyph: '1349', label: 'dauphine to france' }, { glyph: '1860', label: 'savoy french' }],
  'FR-PAC': [{ glyph: '1481', label: 'provence french' }, { glyph: '1860', label: 'nice french' }],
  'FR-COR': [{ glyph: '1755', label: 'corsican republic' }, { glyph: '1768', label: 'corsica french' }, { glyph: '1769', label: 'napoleon born' }],
  'FR-GES': [{ glyph: '1648', label: 'alsace to france' }, { glyph: '1871', label: 'alsace lorraine german' }, { glyph: '1918', label: 'alsace returned' }],
  'FR-HDF': [{ glyph: '1659', label: 'pyrenees treaty' }, { glyph: '1914', label: 'first marne' }, { glyph: '1916', label: 'somme' }],
};

/* ── Spain — 17 autonomous communities ───────────────────────── */

export const ES_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'ES-MD': [{ glyph: '1561', label: 'madrid capital' }, { glyph: '1808', label: 'dos de mayo' }, { glyph: '2004', label: 'madrid bombings' }],
  'ES-CT': [{ glyph: '1137', label: 'crown of aragon' }, { glyph: '1714', label: 'siege of barcelona' }, { glyph: '2017', label: 'catalonia referendum' }],
  'ES-AN': [{ glyph: '711', label: 'al-andalus' }, { glyph: '1492', label: 'granada reconquista' }],
  'ES-VC': [{ glyph: '1238', label: 'valencia conquest' }, { glyph: '1707', label: 'almansa battle' }],
  'ES-GA': [{ glyph: '910', label: 'kingdom of galicia' }, { glyph: '1846', label: 'galician uprising' }],
  'ES-PV': [{ glyph: '1839', label: 'first carlist war end' }, { glyph: '1937', label: 'guernica' }, { glyph: '1979', label: 'basque autonomy' }],
  'ES-CL': [{ glyph: '1037', label: 'kingdom of leon' }, { glyph: '1521', label: 'comuneros revolt' }],
  'ES-CM': [{ glyph: '1085', label: 'toledo reconquest' }, { glyph: '1936', label: 'siege of alcazar' }],
  'ES-AR': [{ glyph: '1035', label: 'kingdom of aragon' }, { glyph: '1283', label: 'general privilege' }],
  'ES-EX': [{ glyph: '1142', label: 'kingdom of badajoz' }, { glyph: '1809', label: 'medellin battle' }],
  'ES-AS': [{ glyph: '722', label: 'covadonga battle' }, { glyph: '1934', label: 'asturias revolution' }],
  'ES-CB': [{ glyph: '1822', label: 'cantabria province' }, { glyph: '1981', label: 'cantabria autonomy' }],
  'ES-NC': [{ glyph: '824', label: 'kingdom of navarre' }, { glyph: '1512', label: 'navarre annexation' }],
  'ES-LO': [{ glyph: '1063', label: 'la rioja navarre' }, { glyph: '1982', label: 'rioja autonomy' }],
  'ES-MU': [{ glyph: '1266', label: 'murcia conquest' }, { glyph: '1707', label: 'murcia bourbon' }],
  'ES-IB': [{ glyph: '1229', label: 'mallorca conquest' }, { glyph: '1715', label: 'balearic decree' }],
  'ES-CN': [{ glyph: '1402', label: 'canary conquest' }, { glyph: '1483', label: 'canary completed' }],
};

/* ── Italy — 20 regions ──────────────────────────────────────── */

export const IT_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'IT-25': [{ glyph: '697', label: 'venice doge' }, { glyph: '1204', label: 'fourth crusade venice' }, { glyph: '1797', label: 'venice falls' }],
  'IT-52': [{ glyph: '1115', label: 'florence commune' }, { glyph: '1469', label: 'lorenzo de medici' }, { glyph: '1530', label: 'florence falls' }],
  'IT-72': [{ glyph: '1131', label: 'sicily kingdom norman' }, { glyph: '1282', label: 'sicilian vespers' }, { glyph: '1860', label: 'mille expedition' }],
  'IT-21': [{ glyph: '1559', label: 'savoy capital turin' }, { glyph: '1861', label: 'savoy unification' }],
  'IT-62': [{ glyph: '47', label: 'roman lazio' }, { glyph: '1870', label: 'rome capital' }, { glyph: '1929', label: 'lateran treaty' }],
  'IT-45': [{ glyph: '1797', label: 'cisalpine republic' }, { glyph: '1947', label: 'emilia romagna founded' }],
  'IT-25-LOMB': [{ glyph: '1176', label: 'legnano battle' }, { glyph: '1535', label: 'lombardy spanish' }],
  'IT-65': [{ glyph: '565', label: 'naples ducato' }, { glyph: '1734', label: 'bourbon naples' }, { glyph: '1860', label: 'naples plebiscite' }],
  'IT-77': [{ glyph: '1130', label: 'puglia norman' }, { glyph: '1734', label: 'bourbon puglia' }],
  'IT-23': [{ glyph: '1748', label: 'aosta savoy' }, { glyph: '1948', label: 'aosta autonomy' }],
  'IT-32': [{ glyph: '1810', label: 'trentino austrian' }, { glyph: '1919', label: 'trentino italian' }],
  'IT-34': [{ glyph: '1815', label: 'venetia austrian' }, { glyph: '1866', label: 'veneto italian' }],
  'IT-36': [{ glyph: '1077', label: 'patriarchate aquileia' }, { glyph: '1947', label: 'fvg founded' }],
  'IT-42': [{ glyph: '1815', label: 'genoa to savoy' }, { glyph: '1849', label: 'liguria unrest' }],
  'IT-55': [{ glyph: '774', label: 'umbria papal' }, { glyph: '1860', label: 'umbria italian' }],
  'IT-57': [{ glyph: '1605', label: 'ancona free port' }, { glyph: '1860', label: 'marche italian' }],
  'IT-67': [{ glyph: '1268', label: 'tagliacozzo battle' }, { glyph: '1860', label: 'abruzzi italian' }],
  'IT-78': [{ glyph: '1860', label: 'calabria italian' }, { glyph: '1908', label: 'messina earthquake' }],
  'IT-75': [{ glyph: '1663', label: 'basilicata earthquake' }, { glyph: '1860', label: 'basilicata italian' }],
  'IT-88': [{ glyph: '1297', label: 'sardinia aragonese' }, { glyph: '1720', label: 'sardinia savoy' }],
};

/* ── Mexico — 12 most-populous states ────────────────────────── */

export const MX_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'MX-CMX': [{ glyph: '1325', label: 'tenochtitlan founded' }, { glyph: '1521', label: 'fall tenochtitlan' }, { glyph: '1968', label: 'mx olympics' }],
  'MX-MEX': [{ glyph: '1325', label: 'aztec empire' }, { glyph: '1521', label: 'spanish conquest mx' }],
  'MX-VER': [{ glyph: '1519', label: 'cortes lands veracruz' }, { glyph: '1838', label: 'pastry war' }],
  'MX-PUE': [{ glyph: '1531', label: 'puebla founded' }, { glyph: '1862', label: 'cinco de mayo' }],
  'MX-JAL': [{ glyph: '1542', label: 'guadalajara founded' }, { glyph: '1810', label: 'hidalgo guadalajara' }],
  'MX-NLE': [{ glyph: '1596', label: 'monterrey founded' }, { glyph: '1846', label: 'monterrey battle' }],
  'MX-GUA': [{ glyph: '1810', label: 'grito de dolores' }, { glyph: '1858', label: 'reform laws' }],
  'MX-CHH': [{ glyph: '1709', label: 'chihuahua founded' }, { glyph: '1916', label: 'pancho villa raid' }],
  'MX-OAX': [{ glyph: '1521', label: 'spanish oaxaca' }, { glyph: '1806', label: 'juarez born' }],
  'MX-YUC': [{ glyph: '987', label: 'maya chichen itza' }, { glyph: '1847', label: 'caste war yucatan' }],
  'MX-CHP': [{ glyph: '1824', label: 'chiapas joins mx' }, { glyph: '1994', label: 'zapatista uprising' }],
  'MX-BCN': [{ glyph: '1769', label: 'baja missions' }, { glyph: '1853', label: 'walker filibuster' }],
};

/* ── Brazil — 12 most-populous states ────────────────────────── */

export const BR_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'BR-SP': [{ glyph: '1554', label: 'sao paulo founded' }, { glyph: '1932', label: 'constitutionalist revolt' }],
  'BR-RJ': [{ glyph: '1565', label: 'rio founded' }, { glyph: '1808', label: 'portuguese court rio' }, { glyph: '1960', label: 'capital moved' }],
  'BR-MG': [{ glyph: '1693', label: 'gold minas gerais' }, { glyph: '1789', label: 'inconfidencia mineira' }],
  'BR-BA': [{ glyph: '1500', label: 'cabral arrives bahia' }, { glyph: '1549', label: 'salvador first capital' }, { glyph: '1798', label: 'tailors revolt' }],
  'BR-PR': [{ glyph: '1853', label: 'parana province' }, { glyph: '1893', label: 'federalist revolution' }],
  'BR-RS': [{ glyph: '1835', label: 'farroupilha revolution' }, { glyph: '1864', label: 'paraguayan war' }],
  'BR-PE': [{ glyph: '1630', label: 'dutch invasion' }, { glyph: '1817', label: 'pernambucan revolution' }],
  'BR-CE': [{ glyph: '1603', label: 'ceara colonization' }, { glyph: '1824', label: 'confederation of equator' }],
  'BR-PA': [{ glyph: '1616', label: 'belem founded' }, { glyph: '1835', label: 'cabanagem' }],
  'BR-SC': [{ glyph: '1738', label: 'sc captaincy' }, { glyph: '1893', label: 'naval revolt sc' }],
  'BR-MA': [{ glyph: '1612', label: 'sao luis founded' }, { glyph: '1838', label: 'balaiada' }],
  'BR-DF': [{ glyph: '1960', label: 'brasilia inaugurated' }],
};

/* ── India — 15 most-populous states ─────────────────────────── */

export const IN_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'IN-UP': [{ glyph: '1857', label: 'sepoy meerut' }, { glyph: '1885', label: 'inc allahabad' }, { glyph: '1992', label: 'babri demolition' }],
  'IN-MH': [{ glyph: '1674', label: 'shivaji coronation' }, { glyph: '1942', label: 'quit india bombay' }],
  'IN-BR': [{ glyph: '322', label: 'mauryan magadha' }, { glyph: '1857', label: 'bihar uprising' }],
  'IN-WB': [{ glyph: '1690', label: 'calcutta founded' }, { glyph: '1757', label: 'plassey battle' }, { glyph: '1947', label: 'bengal partition' }],
  'IN-MP': [{ glyph: '1564', label: 'rani durgavati' }, { glyph: '1984', label: 'bhopal disaster' }],
  'IN-TN': [{ glyph: '850', label: 'chola empire' }, { glyph: '1885', label: 'madras presidency' }],
  'IN-RJ': [{ glyph: '1576', label: 'haldighati battle' }, { glyph: '1818', label: 'rajputana states' }],
  'IN-GJ': [{ glyph: '1411', label: 'ahmedabad founded' }, { glyph: '1930', label: 'salt march dandi' }],
  'IN-KA': [{ glyph: '1336', label: 'vijayanagara empire' }, { glyph: '1799', label: 'fall of seringapatam' }],
  'IN-AP': [{ glyph: '230', label: 'satavahana dynasty' }, { glyph: '1956', label: 'andhra state' }],
  'IN-OR': [{ glyph: '261', label: 'kalinga war' }, { glyph: '1568', label: 'orissa mughal' }],
  'IN-PB': [{ glyph: '1469', label: 'guru nanak born' }, { glyph: '1799', label: 'sikh empire' }, { glyph: '1947', label: 'punjab partition' }],
  'IN-HR': [{ glyph: '1526', label: 'panipat first battle' }, { glyph: '1761', label: 'panipat third battle' }],
  'IN-DL': [{ glyph: '1206', label: 'delhi sultanate' }, { glyph: '1526', label: 'mughal delhi' }, { glyph: '1911', label: 'delhi capital' }],
  'IN-KL': [{ glyph: '1498', label: 'da gama calicut' }, { glyph: '1741', label: 'kulachal battle' }],
};

/* ── China — 12 provinces + 5 autonomous regions ─────────────── */

export const CN_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'CN-BJ': [{ glyph: '1267', label: 'khanbaliq beijing' }, { glyph: '1421', label: 'beijing ming capital' }, { glyph: '1989', label: 'tiananmen' }],
  'CN-SH': [{ glyph: '1842', label: 'shanghai opens' }, { glyph: '1921', label: 'ccp founded' }, { glyph: '1937', label: 'shanghai battle' }],
  'CN-GD': [{ glyph: '1839', label: 'opium war canton' }, { glyph: '1842', label: 'hong kong ceded' }, { glyph: '1980', label: 'shenzhen sez' }],
  'CN-SC': [{ glyph: '221', label: 'qin sichuan' }, { glyph: '1937', label: 'sichuan resistance' }, { glyph: '2008', label: 'sichuan earthquake' }],
  'CN-HE': [{ glyph: '1644', label: 'qing through hebei' }, { glyph: '1976', label: 'tangshan earthquake' }],
  'CN-SD': [{ glyph: '551', label: 'confucius born' }, { glyph: '1899', label: 'boxer rebellion' }],
  'CN-JS': [{ glyph: '1368', label: 'nanjing ming' }, { glyph: '1937', label: 'nanjing massacre' }],
  'CN-ZJ': [{ glyph: '1127', label: 'southern song hangzhou' }, { glyph: '1840', label: 'zhejiang opium war' }],
  'CN-FJ': [{ glyph: '1684', label: 'taiwan qing fujian' }, { glyph: '1842', label: 'fuzhou treaty port' }],
  'CN-HN': [{ glyph: '1644', label: 'shi kefa hubei' }, { glyph: '1911', label: 'wuchang uprising' }],
  'CN-HB': [{ glyph: '1850', label: 'taiping hubei' }, { glyph: '2020', label: 'wuhan covid' }],
  'CN-HA': [{ glyph: '1644', label: 'henan ming-qing' }, { glyph: '1938', label: 'yellow river flood' }],
  'CN-XZ': [{ glyph: '617', label: 'songtsen gampo' }, { glyph: '1950', label: 'tibet annexation' }, { glyph: '1959', label: 'tibet uprising' }],
  'CN-XJ': [{ glyph: '755', label: 'silk road xinjiang' }, { glyph: '1755', label: 'qing xinjiang' }, { glyph: '1949', label: 'xinjiang prc' }],
  'CN-NM': [{ glyph: '1206', label: 'genghis khan' }, { glyph: '1271', label: 'yuan dynasty' }, { glyph: '1947', label: 'inner mongolia ar' }],
  'CN-GX': [{ glyph: '1851', label: 'taiping guangxi' }, { glyph: '1958', label: 'guangxi ar' }],
  'CN-NX': [{ glyph: '1038', label: 'western xia' }, { glyph: '1958', label: 'ningxia ar' }],
};

/* ── Russia — 10 federal subjects with distinct history ──────── */

export const RU_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'RU-MOW': [{ glyph: '1147', label: 'moscow founded' }, { glyph: '1480', label: 'great stand on ugra' }, { glyph: '1812', label: 'moscow burns' }],
  'RU-SPE': [{ glyph: '1703', label: 'st petersburg founded' }, { glyph: '1825', label: 'decembrist revolt' }, { glyph: '1941', label: 'leningrad siege' }],
  'RU-TA': [{ glyph: '1438', label: 'kazan khanate' }, { glyph: '1552', label: 'kazan conquest' }, { glyph: '1992', label: 'tatarstan sovereignty' }],
  'RU-CE': [{ glyph: '1859', label: 'imam shamil surrender' }, { glyph: '1994', label: 'first chechen war' }, { glyph: '1999', label: 'second chechen war' }],
  'RU-CR': [{ glyph: '1783', label: 'crimea annexed catherine' }, { glyph: '1854', label: 'crimean war' }, { glyph: '2014', label: 'crimea annexation' }],
  'RU-NEN': [{ glyph: '1499', label: 'pustozersk founded' }],
  'RU-SAK': [{ glyph: '1875', label: 'sakhalin treaty' }, { glyph: '1945', label: 'sakhalin soviet' }],
  'RU-PRI': [{ glyph: '1860', label: 'vladivostok founded' }, { glyph: '1922', label: 'far eastern republic end' }],
  'RU-KGD': [{ glyph: '1255', label: 'konigsberg founded' }, { glyph: '1945', label: 'kaliningrad soviet' }],
  'RU-DA': [{ glyph: '1722', label: 'persian campaign' }, { glyph: '1859', label: 'shamil dagestan' }],
};

/* ── Smaller-tier slices (Belgium, Switzerland, NL, AR, ZA, KR,
 *    PK, NZ, PL) ──────────────────────────────────────────────── */

export const BE_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'BE-VLG': [{ glyph: '1302', label: 'golden spurs' }, { glyph: '1830', label: 'belgian revolution' }],
  'BE-WAL': [{ glyph: '1815', label: 'waterloo' }, { glyph: '1886', label: 'walloon strikes' }],
  'BE-BRU': [{ glyph: '979', label: 'brussels founded' }, { glyph: '1958', label: 'expo 58' }],
};

export const CH_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'CH-ZH': [{ glyph: '1351', label: 'zurich joins confed' }, { glyph: '1519', label: 'zwingli reformation' }],
  'CH-BE': [{ glyph: '1191', label: 'bern founded' }, { glyph: '1353', label: 'bern joins confed' }],
  'CH-LU': [{ glyph: '1332', label: 'lucerne joins' }, { glyph: '1798', label: 'helvetic republic' }],
  'CH-UR': [{ glyph: '1291', label: 'rutli oath' }, { glyph: '1315', label: 'morgarten battle' }],
  'CH-GE': [{ glyph: '1535', label: 'geneva reformation' }, { glyph: '1815', label: 'geneva joins confed' }],
  'CH-VD': [{ glyph: '1536', label: 'vaud bernese' }, { glyph: '1803', label: 'vaud canton' }],
  'CH-TI': [{ glyph: '1500', label: 'ticino swiss' }, { glyph: '1803', label: 'ticino canton' }],
  'CH-VS': [{ glyph: '1475', label: 'planta battle' }, { glyph: '1815', label: 'valais joins confed' }],
};

export const NL_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'NL-NH': [{ glyph: '1275', label: 'amsterdam toll exemption' }, { glyph: '1602', label: 'voc founded' }],
  'NL-ZH': [{ glyph: '1572', label: 'capture of brielle' }, { glyph: '1648', label: 'westphalia' }],
  'NL-UT': [{ glyph: '696', label: 'willibrord utrecht' }, { glyph: '1579', label: 'union of utrecht' }],
  'NL-FR': [{ glyph: '754', label: 'boniface martyred' }, { glyph: '1498', label: 'frisian freedom' }],
  'NL-GE': [{ glyph: '1543', label: 'gelderland habsburg' }, { glyph: '1944', label: 'arnhem' }],
  'NL-NB': [{ glyph: '1185', label: 'sgraavenhage' }, { glyph: '1629', label: 'siege of s-hertogenbosch' }],
  'NL-LI': [{ glyph: '1839', label: 'limburg dutch' }, { glyph: '1867', label: 'london treaty' }],
  'NL-OV': [{ glyph: '1528', label: 'overijssel habsburg' }, { glyph: '1672', label: 'rampjaar' }],
  'NL-DR': [{ glyph: '1180', label: 'drenthe bishopric' }, { glyph: '1796', label: 'drenthe province' }],
  'NL-GR': [{ glyph: '1040', label: 'groningen city' }, { glyph: '1672', label: 'siege of groningen' }],
  'NL-FL': [{ glyph: '1986', label: 'flevoland province' }],
  'NL-ZE': [{ glyph: '1572', label: 'sea beggars' }, { glyph: '1953', label: 'north sea flood' }],
};

export const AR_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'AR-C': [{ glyph: '1580', label: 'buenos aires refounded' }, { glyph: '1810', label: 'may revolution' }, { glyph: '1955', label: 'revolucion libertadora' }],
  'AR-B': [{ glyph: '1880', label: 'buenos aires capital' }],
  'AR-X': [{ glyph: '1573', label: 'cordoba founded' }, { glyph: '1969', label: 'cordobazo' }],
  'AR-S': [{ glyph: '1573', label: 'santa fe founded' }, { glyph: '1853', label: 'argentine constitution' }],
  'AR-M': [{ glyph: '1561', label: 'mendoza founded' }, { glyph: '1817', label: 'andes crossing' }],
  'AR-T': [{ glyph: '1816', label: 'tucuman independence' }],
  'AR-U': [{ glyph: '1813', label: 'belgrano salta' }, { glyph: '1820', label: 'salta caudillos' }],
  'AR-Y': [{ glyph: '1561', label: 'jujuy founded' }, { glyph: '1812', label: 'jujuy exodus' }],
  'AR-V': [{ glyph: '1881', label: 'patagonia conquest' }],
  'AR-Z': [{ glyph: '1881', label: 'santa cruz patagonia' }],
};

export const ZA_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'ZA-WC': [{ glyph: '1652', label: 'cape colony' }, { glyph: '1910', label: 'union of sa' }],
  'ZA-EC': [{ glyph: '1820', label: '1820 settlers' }, { glyph: '1879', label: 'isandlwana' }],
  'ZA-NL': [{ glyph: '1879', label: 'zulu war' }, { glyph: '1906', label: 'bambatha rebellion' }],
  'ZA-GP': [{ glyph: '1886', label: 'witwatersrand gold' }, { glyph: '1955', label: 'freedom charter' }],
  'ZA-FS': [{ glyph: '1854', label: 'orange free state' }, { glyph: '1899', label: 'second boer war' }],
  'ZA-MP': [{ glyph: '1885', label: 'pilgrim rest gold' }],
  'ZA-LP': [{ glyph: '1898', label: 'pedi rebellion' }],
  'ZA-NW': [{ glyph: '1837', label: 'mzilikazi defeat' }],
  'ZA-NC': [{ glyph: '1869', label: 'kimberley diamond rush' }],
};

export const KR_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'KR-11': [{ glyph: '1394', label: 'seoul capital' }, { glyph: '1950', label: 'seoul falls' }],
  'KR-26': [{ glyph: '1592', label: 'busan invasion' }, { glyph: '1950', label: 'busan perimeter' }],
  'KR-30': [{ glyph: '1980', label: 'gwangju uprising' }],
  'KR-31': [{ glyph: '1597', label: 'myeongnyang' }],
  'KR-50': [{ glyph: '1948', label: 'jeju uprising' }],
  'KR-46': [{ glyph: '1894', label: 'donghak rebellion' }],
  'KR-47': [{ glyph: '1592', label: 'gyeongsangbukdo invasion' }],
  'KR-48': [{ glyph: '1597', label: 'noryang battle' }],
  'KR-43': [{ glyph: '1894', label: 'cheongju donghak' }],
};

export const PK_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'PK-PB': [{ glyph: '1469', label: 'guru nanak punjab' }, { glyph: '1947', label: 'punjab partition pk' }],
  'PK-SD': [{ glyph: '712', label: 'arab sindh' }, { glyph: '1843', label: 'british sindh' }],
  'PK-KP': [{ glyph: '1747', label: 'durrani empire' }, { glyph: '1893', label: 'durand line' }],
  'PK-BA': [{ glyph: '1666', label: 'balochi confederacy' }, { glyph: '1947', label: 'balochistan accession' }],
};

export const NZ_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'NZ-AUK': [{ glyph: '1840', label: 'auckland founded' }, { glyph: '1865', label: 'capital wellington' }],
  'NZ-WGN': [{ glyph: '1840', label: 'wellington founded' }, { glyph: '1855', label: 'wairarapa earthquake' }],
  'NZ-CAN': [{ glyph: '1850', label: 'canterbury settled' }, { glyph: '2011', label: 'christchurch earthquake' }],
  'NZ-OTA': [{ glyph: '1848', label: 'otago founded' }, { glyph: '1861', label: 'otago gold rush' }],
  'NZ-NTL': [{ glyph: '1840', label: 'treaty of waitangi' }, { glyph: '1845', label: 'flagstaff war' }],
  'NZ-WKO': [{ glyph: '1863', label: 'waikato war' }],
  'NZ-BOP': [{ glyph: '1868', label: 'te kooti raid' }],
  'NZ-MWT': [{ glyph: '1868', label: 'titokowaru rebellion' }],
};

export const PL_REGION_EVENTS: Record<string, HistoryGlyph[]> = {
  'PL-MZ': [{ glyph: '1596', label: 'warsaw capital' }, { glyph: '1944', label: 'warsaw uprising' }],
  'PL-MA': [{ glyph: '1364', label: 'krakow university' }, { glyph: '1939', label: 'krakow occupation' }],
  'PL-WP': [{ glyph: '966', label: 'baptism of poland' }, { glyph: '1956', label: 'poznan protests' }],
  'PL-DS': [{ glyph: '1335', label: 'silesia bohemian' }, { glyph: '1945', label: 'silesia polish' }],
  'PL-PM': [{ glyph: '1308', label: 'gdansk teutonic' }, { glyph: '1980', label: 'solidarity gdansk' }],
  'PL-LU': [{ glyph: '1569', label: 'union of lublin' }, { glyph: '1944', label: 'majdanek liberated' }],
  'PL-SK': [{ glyph: '1655', label: 'czestochowa siege' }],
  'PL-SL': [{ glyph: '1922', label: 'silesian uprising' }],
};

/* ── Combined registry ───────────────────────────────────────── */

export const REGIONAL_EVENTS_BY_REGION: Record<string, HistoryGlyph[]> = {
  ...US_STATE_EVENTS,
  ...CA_REGION_EVENTS,
  ...UK_NATION_EVENTS,
  ...IE_REGION_EVENTS,
  ...AU_REGION_EVENTS,
  ...DE_REGION_EVENTS,
  ...FR_REGION_EVENTS,
  ...ES_REGION_EVENTS,
  ...IT_REGION_EVENTS,
  ...MX_REGION_EVENTS,
  ...BR_REGION_EVENTS,
  ...IN_REGION_EVENTS,
  ...CN_REGION_EVENTS,
  ...RU_REGION_EVENTS,
  ...BE_REGION_EVENTS,
  ...CH_REGION_EVENTS,
  ...NL_REGION_EVENTS,
  ...AR_REGION_EVENTS,
  ...ZA_REGION_EVENTS,
  ...KR_REGION_EVENTS,
  ...PK_REGION_EVENTS,
  ...NZ_REGION_EVENTS,
  ...PL_REGION_EVENTS,
};

/** Resolve the ISO-3166-2 country code prefix for a region key.
 *  `US-TX` → `US`, `CA-QC` → `CA`, `UK-SCT` → `UK`. */
export function countryFromRegion(regionKey: string): string {
  return regionKey.split('-')[0];
}

/** Returns the regional event set for the given key, or [] if the
 *  region isn't recognised. */
export function eventsForRegion(regionKey: string | null | undefined): HistoryGlyph[] {
  if (!regionKey) return [];
  return REGIONAL_EVENTS_BY_REGION[regionKey] ?? [];
}
