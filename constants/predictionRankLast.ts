/**
 * Words the English prediction bar ranks last (owner report 2026-10-31: "ger"
 * showed german / germany / gerald / gerry / gerard, read as duplicates).
 *
 * The seed's general vocabulary came from a web word list that includes
 * people's first names, which took short-prefix slots as look-alike tiles.
 * These are US Census first names, minus every ordinary word (dictionary forms
 * included), words in the AAC phrases, and a reviewed keep list of names that
 * also mean a place, brand, food, holiday, character, game or Bible book.
 *
 * Ranked last, never removed: most first names are also something a user may
 * need (Rudolph, San Antonio…), and a name ranked last still shows when it is
 * what matches. The seed counts stay untouched because the language gate
 * (lib/langAllowlist) compares them across languages. A word the user has
 * used is not ranked last.
 */
export const PREDICTION_RANK_LAST: Readonly<Record<string, readonly string[]>> = {
  en: [
    'aaron', 'abby', 'abdul', 'abe', 'abel', 'adele', 'adrian', 'agnes', 'ahmad', 'ahmed',
    'albert', 'alberto', 'alex', 'alexander', 'alexandra', 'alexis', 'alfred', 'ali', 'alicia',
    'allen', 'allison', 'alonso', 'alvin', 'amanda', 'anderson', 'andre', 'andrea', 'andreas',
    'andrew', 'andy', 'angela', 'angelina', 'angelo', 'angie', 'anita', 'anne', 'annie', 'anthony',
    'antoine', 'anton', 'antonio', 'antony', 'arnold', 'asa', 'ashley', 'ashton', 'aubrey',
    'audrey', 'augustus', 'barbara', 'barrett', 'bart', 'bea', 'beatrice', 'becky', 'bella',
    'bennett', 'benton', 'bernard', 'bernie', 'bethany', 'betsy', 'bianca', 'billie', 'blanche',
    'bonnie', 'boris', 'boyd', 'bradley', 'brady', 'brenda', 'brendan', 'brian', 'bridget',
    'britney', 'brooke', 'bruce', 'bruno', 'bryan', 'bryant', 'bryce', 'byron', 'caitlin', 'caleb',
    'calvin', 'cameron', 'camille', 'cara', 'carey', 'carla', 'carlo', 'carlos', 'carlton',
    'carmen', 'carolyn', 'carrie', 'carroll', 'casey', 'cassidy', 'catherine', 'cathy', 'cecil',
    'cesar', 'chan', 'charles', 'cheryl', 'chloe', 'chris', 'christie', 'christina', 'christine',
    'christopher', 'christy', 'chu', 'chung', 'cindy', 'claire', 'clara', 'clare', 'clarence',
    'claude', 'claudia', 'claudio', 'clinton', 'clyde', 'cody', 'connie', 'conrad', 'constance',
    'corey', 'cory', 'courtney', 'craig', 'cristina', 'curtis', 'cynthia', 'cyril', 'damian',
    'damien', 'damon', 'dana', 'dani', 'danielle', 'danny', 'dante', 'darcy', 'darius', 'darren',
    'daryl', 'dave', 'david', 'davis', 'debbie', 'deborah', 'debra', 'della', 'denis', 'denise',
    'dennis', 'denny', 'derek', 'desmond', 'dewey', 'diana', 'diane', 'dillon', 'dion', 'dominic',
    'donnie', 'donovan', 'doris', 'dorothy', 'doug', 'doyle', 'duncan', 'dustin', 'dwayne',
    'dwight', 'dylan', 'eddie', 'edgar', 'edith', 'edmund', 'edna', 'eduardo', 'edward', 'edwin',
    'eileen', 'eleanor', 'elena', 'eli', 'elias', 'elijah', 'eliza', 'elizabeth', 'ella', 'ellen',
    'ellie', 'elliot', 'elliott', 'ellis', 'elton', 'elvis', 'emily', 'emmanuel', 'enrique',
    'erica', 'erik', 'erin', 'ernest', 'ethan', 'eva', 'evan', 'evelyn', 'fallon', 'felipe',
    'ferdinand', 'fernando', 'fiona', 'flo', 'floyd', 'forrest', 'fran', 'francesca', 'francesco',
    'francis', 'frankie', 'freddie', 'freddy', 'frederick', 'gabrielle', 'gail', 'garrett',
    'garry', 'gary', 'gavin', 'geoffrey', 'gerald', 'gerard', 'gerry', 'gil', 'gillian', 'gina',
    'giovanni', 'glenn', 'gloria', 'gordon', 'greg', 'gregg', 'gregory', 'gus', 'gwen', 'hai',
    'hal', 'haley', 'hannah', 'harold', 'harriet', 'harrison', 'harvey', 'hassan', 'hayden',
    'hayley', 'hee', 'heidi', 'helen', 'herbert', 'herman', 'hilary', 'hillary', 'horace',
    'howard', 'hubert', 'hugh', 'hugo', 'hyun', 'ian', 'ida', 'ike', 'irwin', 'isabel', 'isabella',
    'isabelle', 'ivan', 'jackie', 'jacqueline', 'jacques', 'jae', 'jaime', 'jamal', 'jamie',
    'janet', 'janice', 'jarvis', 'jason', 'javier', 'jeanne', 'jefferson', 'jeffrey', 'jen',
    'jennifer', 'jeremy', 'jerome', 'jesse', 'jessica', 'jill', 'jim', 'jin', 'joan', 'joanna',
    'joanne', 'joaquin', 'jolie', 'jon', 'jonas', 'jonathan', 'jong', 'jorge', 'jose', 'josephine',
    'joyce', 'juan', 'judy', 'jules', 'julia', 'julian', 'julie', 'juliet', 'julius', 'jung',
    'justin', 'kara', 'karen', 'karl', 'kate', 'katherine', 'kathleen', 'kathryn', 'kathy',
    'katie', 'katrina', 'katy', 'keith', 'kelley', 'kendrick', 'kenneth', 'kenny', 'kevin',
    'kimberly', 'kris', 'kristen', 'kurt', 'kylie', 'lamar', 'lana', 'lara', 'lauren', 'laurence',
    'laurie', 'leah', 'leigh', 'len', 'lenny', 'leonard', 'leonardo', 'leone', 'leroy', 'leslie',
    'linda', 'lindsay', 'lindsey', 'lisa', 'liz', 'lizzie', 'lloyd', 'lois', 'lola', 'lorenzo',
    'lou', 'louie', 'louisa', 'louise', 'lucas', 'lucia', 'luis', 'luther', 'lydia', 'lyle',
    'lynn', 'mackenzie', 'maggie', 'mai', 'malcolm', 'mandy', 'manuel', 'mara', 'marcus',
    'margaret', 'margot', 'marian', 'marianne', 'marie', 'marilyn', 'marion', 'marta', 'martha',
    'marty', 'marvin', 'marx', 'maureen', 'maurice', 'mckenzie', 'megan', 'mei', 'melanie',
    'melissa', 'melvin', 'meredith', 'mia', 'michael', 'michel', 'michele', 'michelle', 'miguel',
    'milton', 'mimi', 'miranda', 'miriam', 'mitch', 'mitchell', 'mohamed', 'mohammad', 'mohammed',
    'monica', 'monty', 'murray', 'nadia', 'naomi', 'natalie', 'natasha', 'nathan', 'nathaniel',
    'neil', 'neville', 'nicholas', 'nicki', 'nicola', 'nicolas', 'nicole', 'nigel', 'nikki',
    'nina', 'nolan', 'nora', 'norris', 'olga', 'oliver', 'olivia', 'ollie', 'omar', 'owen',
    'paige', 'pamela', 'patricia', 'paula', 'pauline', 'penelope', 'phil', 'philip', 'phillip',
    'phyllis', 'pierre', 'quentin', 'quincy', 'quinn', 'rachel', 'rae', 'rafael', 'ramon',
    'randall', 'randolph', 'raphael', 'raymond', 'reagan', 'rebecca', 'reggie', 'reid', 'rene',
    'renee', 'rey', 'reyes', 'ricardo', 'richard', 'richie', 'ricky', 'robbie', 'robert',
    'roberto', 'ron', 'ronald', 'ronnie', 'roosevelt', 'rosa', 'rosie', 'roy', 'royce', 'rubin',
    'rudolph', 'rudy', 'rupert', 'russ', 'russell', 'ryan', 'samantha', 'sandra', 'sanford',
    'sara', 'sarah', 'sasha', 'saul', 'scarlett', 'sean', 'sebastian', 'serena', 'sergio',
    'seymour', 'shane', 'shannon', 'sharon', 'shaun', 'shawn', 'sheldon', 'shelley', 'shelton',
    'sheridan', 'sherman', 'sid', 'sidney', 'simone', 'sonia', 'soo', 'sophie', 'stacey', 'stacy',
    'stan', 'stanton', 'starr', 'stefan', 'stephanie', 'stephen', 'steve', 'stevie', 'stewart',
    'stuart', 'susan', 'suzanne', 'sylvia', 'tanya', 'tatum', 'teresa', 'theo', 'theodore',
    'theresa', 'tim', 'timmy', 'tina', 'tobias', 'todd', 'tomas', 'toni', 'tracey', 'tracy',
    'trevor', 'tristan', 'truman', 'una', 'valerie', 'vance', 'vanessa', 'vaughn', 'vicky',
    'vince', 'virgil', 'vivian', 'wallace', 'walton', 'wanda', 'wayne', 'wei', 'werner', 'wesley',
    'willard', 'william', 'williams', 'willis', 'winston', 'wyatt', 'xavier', 'xiao', 'yong',
    'yun', 'yuri', 'zack', 'zoe',
  ],
  // Owner report 2026-10-31: "мед" showed the surname медведев between
  // медали and медленно. Only this reviewed surname (and its feminine form);
  // a full Russian name list is planned separately and must keep real words
  // such as вера, надежда, любовь, роза and лев. "медведь" (bear) and its
  // forms (медведи, медведей) are not listed.
  ru: ['медведев', 'медведева'],
};

const sets = new Map<string, ReadonlySet<string>>();

export function rankLastWords(lang: string): ReadonlySet<string> {
  const base = lang.split('-')[0].toLowerCase();
  let set = sets.get(base);
  if (!set) {
    set = new Set(PREDICTION_RANK_LAST[base] ?? []);
    sets.set(base, set);
  }
  return set;
}
