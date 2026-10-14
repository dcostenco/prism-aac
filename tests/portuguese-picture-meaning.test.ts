import { expect, it } from 'vitest';
import { loadPictureWords, pictureWordSource } from '@/constants/pictureWords';
import { builtInVocabularySymbol } from '@/lib/builtInSymbols';

const WRONG_PICTURE_PAIRS = [
 ['feira', 'pl-grocery-store.png', 'a grocery store does not represent the general fair/market meaning'],
 ['linha', 'w-line.png', 'a queue is fila, not linha'],
 ['luz', 'cw-light.png', 'illumination is not light weight'],
 ['série', 'w-series.png', 'TV series and school grade do not match linked squares'],
 ['artigo', 'w-newspaper.png', 'article has common non-newspaper meanings'],
 ['encontro', 'w-meeting.png', 'a meet-up or date is not a group table meeting'],
 ['humanos', 'w-person.png', 'plural humans must not borrow a single-person picture'],
 ['texto', 'w-message.png', 'written text is not specifically a phone message'],
 ['classe', 'sw-class.png', 'social/travel class must not borrow a classroom scene'],
 ['costa', 'pl-beach.png', 'the ambiguous coast/name word must not borrow a beach scene'],
 ['cara', 'pp-man.png', 'face and guy meanings must not share a man picture'],
 ['site', 'w-online.png', 'internet connectivity does not identify a website'],
 ['conseguiu', 'cw-win.png', 'managed to do something does not necessarily mean winning'],
 ['contas', 'w-bill.png', 'accounts and calculations must not borrow a financial bill'],
] as const;

const ACCEPTED_PICTURE_PAIRS = [
 ['chamada', 'call'],
 ['cuidado', 'warning'],
] as const;

it.each(ACCEPTED_PICTURE_PAIRS)('%s shows its %s picture after loading Portuguese', async (word, source) => {
 await loadPictureWords('pt');
 expect(pictureWordSource(word, 'pt')).toBe(source);
 const expected = builtInVocabularySymbol(source, 'en')?.url;
 expect(expected).toBeTruthy();
 expect(builtInVocabularySymbol(word, 'pt')?.url).toBe(expected);
});

it.each(WRONG_PICTURE_PAIRS)('%s does not show %s because %s', async (word, file) => {
 await loadPictureWords('pt');
 expect(pictureWordSource('cachorros', 'pt')).toBe('dog');
 expect(builtInVocabularySymbol('cachorros', 'pt')?.url).toBeTruthy();
 expect(builtInVocabularySymbol(word, 'pt')?.url).not.toBe('/prism-aac/symbols/' + file);
});
