import { getPredictions, learnFromInput, learnWord } from '../../engine/predictionEngine';
import { DEFAULT_PREDICTIONS } from '../../engine/predictionTypes';
import * as repo from '../../db/repository';

jest.mock('../../db/repository');

const mockRepo = repo as jest.Mocked<typeof repo>;

describe('PredictionEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.getTopBigrams.mockResolvedValue([]);
    mockRepo.getTopWords.mockResolvedValue([]);
    mockRepo.getRecentWords.mockResolvedValue([]);
    mockRepo.decayPredictions.mockResolvedValue();
    mockRepo.recordWord.mockResolvedValue();
    mockRepo.recordBigram.mockResolvedValue();
  });

  describe('getPredictions', () => {
    it('returns default predictions when no data exists', async () => {
      const results = await getPredictions('');
      expect(results).toEqual(DEFAULT_PREDICTIONS);
    });

    it('returns default predictions for empty string', async () => {
      const results = await getPredictions('   ');
      expect(results).toEqual(DEFAULT_PREDICTIONS);
    });

    it('returns exactly 5 predictions', async () => {
      const results = await getPredictions('hello');
      expect(results).toHaveLength(5);
    });

    it('uses bigram context when last word is provided', async () => {
      mockRepo.getTopBigrams.mockResolvedValue([
        { word2: 'world', count: 10 },
        { word2: 'there', count: 5 },
      ]);

      const results = await getPredictions('hello');
      expect(mockRepo.getTopBigrams).toHaveBeenCalledWith('hello', 20);
      expect(results[0]).toBe('World');
      expect(results[1]).toBe('There');
    });

    it('filters out the last word from predictions', async () => {
      mockRepo.getTopWords.mockResolvedValue([
        { word: 'hello', count: 100 },
        { word: 'world', count: 50 },
      ]);

      const results = await getPredictions('hello');
      expect(results).not.toContain('Hello');
      expect(results).toContain('World');
    });

    it('combines bigram, frequency, and recency scores', async () => {
      mockRepo.getTopBigrams.mockResolvedValue([
        { word2: 'world', count: 10 },
      ]);
      mockRepo.getTopWords.mockResolvedValue([
        { word: 'please', count: 20 },
        { word: 'world', count: 5 },
      ]);
      mockRepo.getRecentWords.mockResolvedValue([
        { word: 'world', count: 3 },
      ]);

      const results = await getPredictions('hello');
      // 'world' should rank high due to all three signals
      expect(results[0]).toBe('World');
    });

    it('fills remaining slots with defaults', async () => {
      mockRepo.getTopBigrams.mockResolvedValue([
        { word2: 'world', count: 10 },
      ]);

      const results = await getPredictions('hello');
      expect(results).toHaveLength(5);
      // First is learned, rest are defaults
      expect(results[0]).toBe('World');
    });

    it('does not duplicate defaults already in predictions', async () => {
      mockRepo.getTopWords.mockResolvedValue([
        { word: 'i', count: 100 },
      ]);

      const results = await getPredictions('');
      const iCount = results.filter(r => r.toLowerCase() === 'i').length;
      expect(iCount).toBeLessThanOrEqual(1);
    });

    it('handles multi-word input correctly', async () => {
      mockRepo.getTopBigrams.mockResolvedValue([
        { word2: 'please', count: 5 },
      ]);

      const results = await getPredictions('I would like to order');
      expect(mockRepo.getTopBigrams).toHaveBeenCalledWith('order', 20);
    });

    it('capitalizes first letter of predictions', async () => {
      mockRepo.getTopBigrams.mockResolvedValue([
        { word2: 'hello', count: 10 },
      ]);

      const results = await getPredictions('say');
      expect(results[0]).toBe('Hello');
    });

    // Edge cases
    it('handles input with multiple spaces', async () => {
      const results = await getPredictions('hello    world');
      expect(mockRepo.getTopBigrams).toHaveBeenCalledWith('world', 20);
    });

    it('handles input with trailing spaces', async () => {
      const results = await getPredictions('hello ');
      expect(results).toHaveLength(5);
    });

    it('handles single character input', async () => {
      const results = await getPredictions('a');
      expect(mockRepo.getTopBigrams).toHaveBeenCalledWith('a', 20);
    });

    it('handles very long input', async () => {
      const longText = Array(100).fill('word').join(' ');
      const results = await getPredictions(longText);
      expect(results).toHaveLength(5);
      expect(mockRepo.getTopBigrams).toHaveBeenCalledWith('word', 20);
    });
  });

  describe('learnFromInput', () => {
    it('records each word individually', async () => {
      await learnFromInput('hello world');
      expect(mockRepo.recordWord).toHaveBeenCalledWith('hello');
      expect(mockRepo.recordWord).toHaveBeenCalledWith('world');
      expect(mockRepo.recordWord).toHaveBeenCalledTimes(2);
    });

    it('records bigrams for consecutive words', async () => {
      await learnFromInput('hello beautiful world');
      expect(mockRepo.recordBigram).toHaveBeenCalledWith('hello', 'beautiful');
      expect(mockRepo.recordBigram).toHaveBeenCalledWith('beautiful', 'world');
      expect(mockRepo.recordBigram).toHaveBeenCalledTimes(2);
    });

    it('handles single word input', async () => {
      await learnFromInput('hello');
      expect(mockRepo.recordWord).toHaveBeenCalledTimes(1);
      expect(mockRepo.recordBigram).not.toHaveBeenCalled();
    });

    it('handles empty input', async () => {
      await learnFromInput('');
      expect(mockRepo.recordWord).not.toHaveBeenCalled();
    });

    it('handles whitespace-only input', async () => {
      await learnFromInput('   ');
      expect(mockRepo.recordWord).not.toHaveBeenCalled();
    });

    it('trims and splits on multiple spaces', async () => {
      await learnFromInput('  hello   world  ');
      expect(mockRepo.recordWord).toHaveBeenCalledWith('hello');
      expect(mockRepo.recordWord).toHaveBeenCalledWith('world');
      expect(mockRepo.recordWord).toHaveBeenCalledTimes(2);
    });
  });

  describe('learnWord', () => {
    it('records word and bigram when previous word given', async () => {
      await learnWord('world', 'hello');
      expect(mockRepo.recordWord).toHaveBeenCalledWith('world');
      expect(mockRepo.recordBigram).toHaveBeenCalledWith('hello', 'world');
    });

    it('records only word when no previous word', async () => {
      await learnWord('hello');
      expect(mockRepo.recordWord).toHaveBeenCalledWith('hello');
      expect(mockRepo.recordBigram).not.toHaveBeenCalled();
    });
  });
});
