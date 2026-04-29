import { useMessageStore } from '../../store/messageStore';

describe('MessageStore', () => {
  beforeEach(() => {
    useMessageStore.setState({ text: '', activeTone: 'friendly' });
  });

  describe('appendWord', () => {
    it('appends word to empty text', () => {
      useMessageStore.getState().appendWord('Hello');
      expect(useMessageStore.getState().text).toBe('Hello');
    });

    it('appends word with space separator', () => {
      useMessageStore.setState({ text: 'Hello' });
      useMessageStore.getState().appendWord('world');
      expect(useMessageStore.getState().text).toBe('Hello world');
    });

    it('handles multiple appends', () => {
      const { appendWord } = useMessageStore.getState();
      appendWord('I');
      appendWord('need');
      appendWord('help');
      expect(useMessageStore.getState().text).toBe('I need help');
    });
  });

  describe('appendText', () => {
    it('appends phrase to empty text', () => {
      useMessageStore.getState().appendText('I need help');
      expect(useMessageStore.getState().text).toBe('I need help');
    });

    it('appends phrase with space separator', () => {
      useMessageStore.setState({ text: 'Hello.' });
      useMessageStore.getState().appendText('I need help');
      expect(useMessageStore.getState().text).toBe('Hello. I need help');
    });
  });

  describe('deleteLastWord', () => {
    it('removes last word', () => {
      useMessageStore.setState({ text: 'Hello world' });
      useMessageStore.getState().deleteLastWord();
      expect(useMessageStore.getState().text).toBe('Hello');
    });

    it('clears text when only one word', () => {
      useMessageStore.setState({ text: 'Hello' });
      useMessageStore.getState().deleteLastWord();
      expect(useMessageStore.getState().text).toBe('');
    });

    it('handles empty text gracefully', () => {
      useMessageStore.setState({ text: '' });
      useMessageStore.getState().deleteLastWord();
      expect(useMessageStore.getState().text).toBe('');
    });

    it('handles text with trailing spaces', () => {
      useMessageStore.setState({ text: 'Hello world  ' });
      useMessageStore.getState().deleteLastWord();
      expect(useMessageStore.getState().text).toBe('Hello');
    });

    it('handles text with multiple spaces between words', () => {
      useMessageStore.setState({ text: 'Hello   world' });
      useMessageStore.getState().deleteLastWord();
      expect(useMessageStore.getState().text).toBe('Hello');
    });
  });

  describe('clearAll', () => {
    it('clears all text', () => {
      useMessageStore.setState({ text: 'Hello world' });
      useMessageStore.getState().clearAll();
      expect(useMessageStore.getState().text).toBe('');
    });

    it('is idempotent on empty text', () => {
      useMessageStore.getState().clearAll();
      expect(useMessageStore.getState().text).toBe('');
    });
  });

  describe('setTone', () => {
    it('sets tone', () => {
      useMessageStore.getState().setTone('serious');
      expect(useMessageStore.getState().activeTone).toBe('serious');
    });

    it('preserves text when changing tone', () => {
      useMessageStore.setState({ text: 'Help me' });
      useMessageStore.getState().setTone('calm');
      expect(useMessageStore.getState().text).toBe('Help me');
      expect(useMessageStore.getState().activeTone).toBe('calm');
    });
  });

  describe('setText', () => {
    it('replaces text entirely', () => {
      useMessageStore.setState({ text: 'old text' });
      useMessageStore.getState().setText('new text');
      expect(useMessageStore.getState().text).toBe('new text');
    });

    it('can set empty text', () => {
      useMessageStore.setState({ text: 'something' });
      useMessageStore.getState().setText('');
      expect(useMessageStore.getState().text).toBe('');
    });
  });
});
