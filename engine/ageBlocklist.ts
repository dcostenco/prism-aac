export const PROFANITY = new Set([
  'shit', 'fuck', 'ass', 'bitch', 'bastard', 'crap',
  'dick', 'cock', 'pussy', 'slut', 'whore', 'piss', 'asshole',
  'bullshit', 'goddamn', 'motherfucker', 'nigger', 'faggot', 'retard',
  'porn', 'sex', 'naked', 'nude',
  'satan', 'devil', 'demon',
]);

export const SENSITIVE = new Set([
  'hell', 'damn',
  'kill', 'suicide', 'murder', 'rape',
  'drug', 'drugs', 'cocaine', 'heroin', 'meth', 'weed',
  'gun', 'bomb', 'weapon', 'terrorist',
  'die', 'dead', 'death',
  'hate', 'stupid', 'idiot', 'dumb', 'ugly', 'fat', 'loser',
]);

export const AGE_BLOCKED_WORDS = new Set([...PROFANITY, ...SENSITIVE]);
