import { SupportedLanguage } from '@/engine/i18n';

const T: Record<string, Partial<Record<SupportedLanguage, string>>> = {
  // Core Words — Pronouns
  'cw-i':     { ro: 'Eu', es: 'Yo', fr: 'Je', pt: 'Eu', de: 'Ich', ru: 'Я', uk: 'Я', ja: '私', ko: '나', zh: '我', ar: 'أنا' },
  'cw-you':   { ro: 'Tu', es: 'Tú', fr: 'Tu', pt: 'Você', de: 'Du', ru: 'Ты', uk: 'Ти', ja: 'あなた', ko: '너', zh: '你', ar: 'أنت' },
  'cw-he':    { ro: 'El', es: 'Él', fr: 'Il', pt: 'Ele', de: 'Er', ru: 'Он', uk: 'Він', ja: '彼', ko: '그', zh: '他', ar: 'هو' },
  'cw-she':   { ro: 'Ea', es: 'Ella', fr: 'Elle', pt: 'Ela', de: 'Sie', ru: 'Она', uk: 'Вона', ja: '彼女', ko: '그녀', zh: '她', ar: 'هي' },
  'cw-it':    { ro: 'El/Ea', es: 'Ello', fr: 'Ça', pt: 'Isso', de: 'Es', ru: 'Это', uk: 'Це', ja: 'それ', ko: '그것', zh: '它', ar: 'هو/هي' },
  'cw-we':    { ro: 'Noi', es: 'Nosotros', fr: 'Nous', pt: 'Nós', de: 'Wir', ru: 'Мы', uk: 'Ми', ja: '私たち', ko: '우리', zh: '我们', ar: 'نحن' },
  'cw-they':  { ro: 'Ei/Ele', es: 'Ellos', fr: 'Ils', pt: 'Eles', de: 'Sie', ru: 'Они', uk: 'Вони', ja: '彼ら', ko: '그들', zh: '他们', ar: 'هم' },
  'cw-me':    { ro: 'Mie', es: 'A mí', fr: 'Moi', pt: 'Mim', de: 'Mir', ru: 'Мне', uk: 'Мені', ja: '私に', ko: '나에게', zh: '我(宾)', ar: 'لي' },
  'cw-my':    { ro: 'Al meu', es: 'Mi', fr: 'Mon', pt: 'Meu', de: 'Mein', ru: 'Мой', uk: 'Мій', ja: '私の', ko: '내', zh: '我的', ar: 'ملكي' },
  'cw-your':  { ro: 'Al tău', es: 'Tu', fr: 'Ton', pt: 'Seu', de: 'Dein', ru: 'Твой', uk: 'Твій', ja: 'あなたの', ko: '네', zh: '你的', ar: 'ملكك' },
  'cw-his':   { ro: 'Al lui', es: 'Su', fr: 'Son', pt: 'Dele', de: 'Sein', ru: 'Его', uk: 'Його', ja: '彼の', ko: '그의', zh: '他的', ar: 'ملكه' },
  'cw-her':   { ro: 'Al ei', es: 'Su', fr: 'Sa', pt: 'Dela', de: 'Ihr', ru: 'Её', uk: 'Її', ja: '彼女の', ko: '그녀의', zh: '她的', ar: 'ملكها' },
  'cw-this':  { ro: 'Asta', es: 'Esto', fr: 'Ceci', pt: 'Isto', de: 'Dies', ru: 'Это', uk: 'Це', ja: 'これ', ko: '이것', zh: '这个', ar: 'هذا' },
  'cw-that':  { ro: 'Aia', es: 'Eso', fr: 'Cela', pt: 'Isso', de: 'Das', ru: 'То', uk: 'То', ja: 'あれ', ko: '저것', zh: '那个', ar: 'ذلك' },

  // Core Words — Verbs
  'cw-want':     { ro: 'Vreau', es: 'Quiero', fr: 'Veux', pt: 'Quero', de: 'Will', ru: 'Хочу', uk: 'Хочу', ja: '欲しい', ko: '원해요', zh: '要', ar: 'أريد' },
  'cw-like':     { ro: 'Îmi place', es: 'Me gusta', fr: 'Aime', pt: 'Gosto', de: 'Mag', ru: 'Нравится', uk: 'Подобається', ja: '好き', ko: '좋아요', zh: '喜欢', ar: 'أحب' },
  'cw-have':     { ro: 'Am', es: 'Tengo', fr: 'Ai', pt: 'Tenho', de: 'Habe', ru: 'Имею', uk: 'Маю', ja: '持っている', ko: '있어요', zh: '有', ar: 'عندي' },
  'cw-do':       { ro: 'Fac', es: 'Hago', fr: 'Fais', pt: 'Faço', de: 'Mache', ru: 'Делаю', uk: 'Роблю', ja: 'する', ko: '해요', zh: '做', ar: 'أفعل' },
  'cw-can':      { ro: 'Pot', es: 'Puedo', fr: 'Peux', pt: 'Posso', de: 'Kann', ru: 'Могу', uk: 'Можу', ja: 'できる', ko: '할 수 있어요', zh: '能', ar: 'أستطيع' },
  'cw-need':     { ro: 'Am nevoie', es: 'Necesito', fr: 'Besoin', pt: 'Preciso', de: 'Brauche', ru: 'Нужно', uk: 'Потрібно', ja: '必要', ko: '필요해요', zh: '需要', ar: 'أحتاج' },
  'cw-know':     { ro: 'Știu', es: 'Sé', fr: 'Sais', pt: 'Sei', de: 'Weiß', ru: 'Знаю', uk: 'Знаю', ja: '知っている', ko: '알아요', zh: '知道', ar: 'أعرف' },
  'cw-see':      { ro: 'Văd', es: 'Veo', fr: 'Vois', pt: 'Vejo', de: 'Sehe', ru: 'Вижу', uk: 'Бачу', ja: '見える', ko: '봐요', zh: '看见', ar: 'أرى' },
  'cw-think':    { ro: 'Cred', es: 'Creo', fr: 'Pense', pt: 'Acho', de: 'Denke', ru: 'Думаю', uk: 'Думаю', ja: '思う', ko: '생각해요', zh: '想', ar: 'أعتقد' },
  'cw-feel':     { ro: 'Simt', es: 'Siento', fr: 'Sens', pt: 'Sinto', de: 'Fühle', ru: 'Чувствую', uk: 'Відчуваю', ja: '感じる', ko: '느껴요', zh: '感觉', ar: 'أشعر' },
  'cw-say':      { ro: 'Spun', es: 'Digo', fr: 'Dis', pt: 'Digo', de: 'Sage', ru: 'Говорю', uk: 'Кажу', ja: '言う', ko: '말해요', zh: '说', ar: 'أقول' },
  'cw-tell':     { ro: 'Spune', es: 'Decir', fr: 'Dire', pt: 'Contar', de: 'Erzählen', ru: 'Расскажи', uk: 'Розкажи', ja: '教えて', ko: '알려줘요', zh: '告诉', ar: 'أخبر' },
  'cw-try':      { ro: 'Încerc', es: 'Intento', fr: 'Essaie', pt: 'Tento', de: 'Versuche', ru: 'Пробую', uk: 'Пробую', ja: 'やってみる', ko: '해볼게요', zh: '试试', ar: 'أحاول' },
  'cw-let':      { ro: 'Lasă', es: 'Deja', fr: 'Laisse', pt: 'Deixe', de: 'Lass', ru: 'Позволь', uk: 'Дозволь', ja: 'させて', ko: '하게 해줘요', zh: '让', ar: 'دعني' },
  'cw-help':     { ro: 'Ajutor', es: 'Ayuda', fr: 'Aide', pt: 'Ajuda', de: 'Hilfe', ru: 'Помоги', uk: 'Допоможи', ja: '助けて', ko: '도와줘요', zh: '帮', ar: 'ساعدني' },
  'cw-make':     { ro: 'Fă', es: 'Hacer', fr: 'Faire', pt: 'Fazer', de: 'Machen', ru: 'Сделай', uk: 'Зроби', ja: '作って', ko: '만들어요', zh: '做', ar: 'اصنع' },
  'cw-come':     { ro: 'Vino', es: 'Ven', fr: 'Viens', pt: 'Venha', de: 'Komm', ru: 'Приди', uk: 'Приходь', ja: '来て', ko: '와요', zh: '来', ar: 'تعال' },
  'cw-go-core':  { ro: 'Du-te', es: 'Ir', fr: 'Aller', pt: 'Ir', de: 'Gehen', ru: 'Иди', uk: 'Іди', ja: '行く', ko: '가요', zh: '去', ar: 'اذهب' },
  'cw-get-core': { ro: 'Ia', es: 'Conseguir', fr: 'Obtenir', pt: 'Pegar', de: 'Holen', ru: 'Возьми', uk: 'Візьми', ja: '取って', ko: '가져와요', zh: '拿', ar: 'خذ' },
  'cw-put-core': { ro: 'Pune', es: 'Poner', fr: 'Mettre', pt: 'Colocar', de: 'Legen', ru: 'Положи', uk: 'Поклади', ja: '置いて', ko: '놔요', zh: '放', ar: 'ضع' },

  // Core Words — Descriptors
  'cw-more':      { ro: 'Mai mult', es: 'Más', fr: 'Plus', pt: 'Mais', de: 'Mehr', ru: 'Ещё', uk: 'Ще', ja: 'もっと', ko: '더', zh: '更多', ar: 'أكثر' },
  'cw-not':       { ro: 'Nu', es: 'No', fr: 'Pas', pt: 'Não', de: 'Nicht', ru: 'Не', uk: 'Не', ja: 'ない', ko: '아니요', zh: '不', ar: 'ليس' },
  'cw-no-core':   { ro: 'Nu', es: 'No', fr: 'Non', pt: 'Não', de: 'Nein', ru: 'Нет', uk: 'Ні', ja: 'いいえ', ko: '아니요', zh: '不', ar: 'لا' },
  'cw-yes-core':  { ro: 'Da', es: 'Sí', fr: 'Oui', pt: 'Sim', de: 'Ja', ru: 'Да', uk: 'Так', ja: 'はい', ko: '네', zh: '是', ar: 'نعم' },
  'cw-all':       { ro: 'Tot', es: 'Todo', fr: 'Tout', pt: 'Tudo', de: 'Alles', ru: 'Всё', uk: 'Все', ja: '全部', ko: '전부', zh: '全部', ar: 'كل' },
  'cw-some':      { ro: 'Câteva', es: 'Algunos', fr: 'Quelques', pt: 'Alguns', de: 'Einige', ru: 'Немного', uk: 'Деякі', ja: 'いくつか', ko: '몇 개', zh: '一些', ar: 'بعض' },
  'cw-other':     { ro: 'Altul', es: 'Otro', fr: 'Autre', pt: 'Outro', de: 'Anderes', ru: 'Другой', uk: 'Інший', ja: '他の', ko: '다른', zh: '其他', ar: 'آخر' },
  'cw-very':      { ro: 'Foarte', es: 'Muy', fr: 'Très', pt: 'Muito', de: 'Sehr', ru: 'Очень', uk: 'Дуже', ja: 'とても', ko: '매우', zh: '很', ar: 'جدا' },
  'cw-here':      { ro: 'Aici', es: 'Aquí', fr: 'Ici', pt: 'Aqui', de: 'Hier', ru: 'Здесь', uk: 'Тут', ja: 'ここ', ko: '여기', zh: '这里', ar: 'هنا' },
  'cw-there':     { ro: 'Acolo', es: 'Allí', fr: 'Là', pt: 'Ali', de: 'Dort', ru: 'Там', uk: 'Там', ja: 'あそこ', ko: '저기', zh: '那里', ar: 'هناك' },
  'cw-up':        { ro: 'Sus', es: 'Arriba', fr: 'Haut', pt: 'Cima', de: 'Hoch', ru: 'Вверх', uk: 'Вгору', ja: '上', ko: '위', zh: '上', ar: 'فوق' },
  'cw-down':      { ro: 'Jos', es: 'Abajo', fr: 'Bas', pt: 'Baixo', de: 'Runter', ru: 'Вниз', uk: 'Вниз', ja: '下', ko: '아래', zh: '下', ar: 'تحت' },
  'cw-in':        { ro: 'Înăuntru', es: 'Dentro', fr: 'Dans', pt: 'Dentro', de: 'Rein', ru: 'Внутри', uk: 'Всередині', ja: '中', ko: '안', zh: '里', ar: 'في' },
  'cw-out':       { ro: 'Afară', es: 'Fuera', fr: 'Dehors', pt: 'Fora', de: 'Raus', ru: 'Наружу', uk: 'Назовні', ja: '外', ko: '밖', zh: '外', ar: 'خارج' },
  'cw-on':        { ro: 'Pe', es: 'En', fr: 'Sur', pt: 'Em', de: 'An', ru: 'На', uk: 'На', ja: '上に', ko: '위에', zh: '上面', ar: 'على' },
  'cw-off':       { ro: 'Oprit', es: 'Apagado', fr: 'Éteint', pt: 'Desligado', de: 'Aus', ru: 'Выкл', uk: 'Вимк', ja: 'オフ', ko: '꺼요', zh: '关掉', ar: 'مطفأ' },
  'cw-done':      { ro: 'Gata', es: 'Listo', fr: 'Fini', pt: 'Pronto', de: 'Fertig', ru: 'Готово', uk: 'Готово', ja: '終わり', ko: '끝', zh: '完了', ar: 'تم' },
  'cw-again':     { ro: 'Din nou', es: 'Otra vez', fr: 'Encore', pt: 'De novo', de: 'Nochmal', ru: 'Снова', uk: 'Знову', ja: 'もう一回', ko: '다시', zh: '再', ar: 'مرة أخرى' },
  'cw-too':       { ro: 'Și', es: 'También', fr: 'Aussi', pt: 'Também', de: 'Auch', ru: 'Тоже', uk: 'Теж', ja: 'も', ko: '도', zh: '也', ar: 'أيضا' },
  'cw-same-core': { ro: 'La fel', es: 'Igual', fr: 'Pareil', pt: 'Igual', de: 'Gleich', ru: 'Так же', uk: 'Так само', ja: '同じ', ko: '같아요', zh: '一样', ar: 'نفسه' },

  // Core Words — Little Words
  'cw-is':        { ro: 'Este', es: 'Es', fr: 'Est', pt: 'É', de: 'Ist', ru: 'Есть', uk: 'Є', ja: 'です', ko: '이에요', zh: '是', ar: 'هو' },
  'cw-the':       { ro: '-', es: 'El/La', fr: 'Le/La', pt: 'O/A', de: 'Der/Die', ru: '-', uk: '-', ja: '-', ko: '-', zh: '-', ar: 'ال' },
  'cw-a':         { ro: 'Un/O', es: 'Un/Una', fr: 'Un/Une', pt: 'Um/Uma', de: 'Ein/Eine', ru: '-', uk: '-', ja: '-', ko: '-', zh: '一个', ar: '-' },
  'cw-and':       { ro: 'Și', es: 'Y', fr: 'Et', pt: 'E', de: 'Und', ru: 'И', uk: 'І', ja: 'と', ko: '그리고', zh: '和', ar: 'و' },
  'cw-but':       { ro: 'Dar', es: 'Pero', fr: 'Mais', pt: 'Mas', de: 'Aber', ru: 'Но', uk: 'Але', ja: 'でも', ko: '하지만', zh: '但是', ar: 'لكن' },
  'cw-or':        { ro: 'Sau', es: 'O', fr: 'Ou', pt: 'Ou', de: 'Oder', ru: 'Или', uk: 'Або', ja: 'か', ko: '또는', zh: '或者', ar: 'أو' },
  // ru/uk: infinitive "to" has no equivalent in Russian/Ukrainian (bare infinitive).
  // "К" / "До" are directional prepositions handled by AI-refine when needed.
  'cw-to':        { ro: 'La', es: 'A', fr: 'À', pt: 'Para', de: 'Zu', ru: '', uk: '', ja: 'へ', ko: '에', zh: '到', ar: 'إلى' },
  // "vreau să" (RO: "I want to") — explicit override because clinicalVocabulary has a
  // positional misalignment that maps "vreau să" → "нравится" (like) instead of "хочу" (want).
  // Since phraseTranslations runs before clinical vocab in dict-build, this takes precedence.
  'cw-want-to':   { ro: 'Vreau să', es: 'Quiero', fr: 'Je veux', pt: 'Quero', de: 'Ich will', ru: 'Я хочу', uk: 'Я хочу', ja: 'したい', ko: '하고 싶어요', zh: '我想', ar: 'أريد أن' },
  'cw-for':       { ro: 'Pentru', es: 'Para', fr: 'Pour', pt: 'Para', de: 'Für', ru: 'Для', uk: 'Для', ja: 'のために', ko: '위해', zh: '为了', ar: 'لأجل' },
  'cw-with':      { ro: 'Cu', es: 'Con', fr: 'Avec', pt: 'Com', de: 'Mit', ru: 'С', uk: 'З', ja: 'と一緒に', ko: '같이', zh: '跟', ar: 'مع' },
  'cw-at':        { ro: 'La', es: 'En', fr: 'À', pt: 'Em', de: 'Bei', ru: 'В', uk: 'В', ja: 'で', ko: '에서', zh: '在', ar: 'في' },
  'cw-of':        { ro: 'De', es: 'De', fr: 'De', pt: 'De', de: 'Von', ru: 'Из', uk: 'З', ja: 'の', ko: '의', zh: '的', ar: 'من' },
  'cw-about':     { ro: 'Despre', es: 'Sobre', fr: 'À propos', pt: 'Sobre', de: 'Über', ru: 'О', uk: 'Про', ja: 'について', ko: '에 대해', zh: '关于', ar: 'عن' },
  'cw-because':   { ro: 'Pentru că', es: 'Porque', fr: 'Parce que', pt: 'Porque', de: 'Weil', ru: 'Потому что', uk: 'Тому що', ja: 'なぜなら', ko: '왜냐하면', zh: '因为', ar: 'لأن' },
  'cw-if':        { ro: 'Dacă', es: 'Si', fr: 'Si', pt: 'Se', de: 'Wenn', ru: 'Если', uk: 'Якщо', ja: 'もし', ko: '만약', zh: '如果', ar: 'إذا' },
  'cw-when-core': { ro: 'Când', es: 'Cuando', fr: 'Quand', pt: 'Quando', de: 'Wann', ru: 'Когда', uk: 'Коли', ja: 'いつ', ko: '언제', zh: '什么时候', ar: 'متى' },
  'cw-where-core':{ ro: 'Unde', es: 'Dónde', fr: 'Où', pt: 'Onde', de: 'Wo', ru: 'Где', uk: 'Де', ja: 'どこ', ko: '어디', zh: '哪里', ar: 'أين' },

  // Help / Needs
  'help-all-done':    { ro: 'Gata', es: 'Terminé', fr: 'Fini', pt: 'Pronto', de: 'Fertig', ru: 'Готово', uk: 'Готово', ja: 'おわり', ko: '다 했어요', zh: '完成了', ar: 'انتهيت' },
  'help-break':       { ro: 'Pauză', es: 'Descanso', fr: 'Pause', pt: 'Pausa', de: 'Pause', ru: 'Перерыв', uk: 'Перерва', ja: '休憩', ko: '쉬고 싶어요', zh: '休息', ar: 'استراحة' },
  'help-need-help':   { ro: 'Am nevoie de ajutor', es: 'Necesito ayuda', fr: "J'ai besoin d'aide", pt: 'Preciso de ajuda', de: 'Ich brauche Hilfe', ru: 'Мне нужна помощь', uk: 'Мені потрібна допомога', ja: '助けて', ko: '도와주세요', zh: '我需要帮助', ar: 'أحتاج مساعدة' },
  'help-hungry':      { ro: 'Mi-e foame', es: 'Tengo hambre', fr: "J'ai faim", pt: 'Estou com fome', de: 'Ich habe Hunger', ru: 'Я голоден', uk: 'Я голодний', ja: 'お腹すいた', ko: '배고파요', zh: '我饿了', ar: 'أنا جائع' },
  'help-thirsty':     { ro: 'Mi-e sete', es: 'Tengo sed', fr: "J'ai soif", pt: 'Estou com sede', de: 'Ich habe Durst', ru: 'Я хочу пить', uk: 'Я хочу пити', ja: 'のどがかわいた', ko: '목마르요', zh: '我渴了', ar: 'أنا عطشان' },
  'help-bathroom':    { ro: 'Baie', es: 'Baño', fr: 'Toilettes', pt: 'Banheiro', de: 'Toilette', ru: 'Туалет', uk: 'Туалет', ja: 'トイレ', ko: '화장실', zh: '厕所', ar: 'حمام' },
  'help-yes':         { ro: 'Da', es: 'Sí', fr: 'Oui', pt: 'Sim', de: 'Ja', ru: 'Да', uk: 'Так', ja: 'はい', ko: '네', zh: '是', ar: 'نعم' },
  'help-no':          { ro: 'Nu', es: 'No', fr: 'Non', pt: 'Não', de: 'Nein', ru: 'Нет', uk: 'Ні', ja: 'いいえ', ko: '아니요', zh: '不', ar: 'لا' },
  'help-stop':        { ro: 'Stop', es: 'Para', fr: 'Arrête', pt: 'Pare', de: 'Stopp', ru: 'Стоп', uk: 'Стоп', ja: 'やめて', ko: '그만', zh: '停', ar: 'قف' },
  'help-more':        { ro: 'Mai mult', es: 'Más', fr: 'Encore', pt: 'Mais', de: 'Mehr', ru: 'Ещё', uk: 'Ще', ja: 'もっと', ko: '더', zh: '更多', ar: 'المزيد' },
  'help-want':        { ro: 'Vreau', es: 'Quiero', fr: 'Je veux', pt: 'Eu quero', de: 'Ich will', ru: 'Я хочу', uk: 'Я хочу', ja: 'ほしい', ko: '원해요', zh: '我要', ar: 'أريد' },
  'help-dont-want':   { ro: 'Nu vreau', es: 'No quiero', fr: 'Je ne veux pas', pt: 'Não quero', de: 'Ich will nicht', ru: 'Я не хочу', uk: 'Я не хочу', ja: 'いらない', ko: '싫어요', zh: '我不要', ar: 'لا أريد' },
  'help-hurts':       { ro: 'Mă doare', es: 'Me duele', fr: "J'ai mal", pt: 'Dói', de: 'Es tut weh', ru: 'Больно', uk: 'Болить', ja: '痛い', ko: '아파요', zh: '痛', ar: 'يؤلمني' },
  'help-tired':       { ro: 'Sunt obosit', es: 'Estoy cansado', fr: 'Je suis fatigué', pt: 'Estou cansado', de: 'Ich bin müde', ru: 'Я устал', uk: 'Я втомився', ja: '疲れた', ko: '피곤해요', zh: '我累了', ar: 'أنا تعبان' },

  // Quick Talk
  'qt-hello':         { ro: 'Bună', es: 'Hola', fr: 'Bonjour', pt: 'Olá', de: 'Hallo', ru: 'Привет', uk: 'Привіт', ja: 'こんにちは', ko: '안녕하세요', zh: '你好', ar: 'مرحبا' },
  'qt-goodbye':       { ro: 'La revedere', es: 'Adiós', fr: 'Au revoir', pt: 'Tchau', de: 'Tschüss', ru: 'Пока', uk: 'Бувай', ja: 'さようなら', ko: '안녕히 가세요', zh: '再见', ar: 'مع السلامة' },
  'qt-thank-you':     { ro: 'Mulțumesc', es: 'Gracias', fr: 'Merci', pt: 'Obrigado', de: 'Danke', ru: 'Спасибо', uk: 'Дякую', ja: 'ありがとう', ko: '감사합니다', zh: '谢谢', ar: 'شكرا' },
  'qt-please':        { ro: 'Te rog', es: 'Por favor', fr: "S'il vous plaît", pt: 'Por favor', de: 'Bitte', ru: 'Пожалуйста', uk: 'Будь ласка', ja: 'お願いします', ko: '제발', zh: '请', ar: 'من فضلك' },
  'qt-excuse-me':     { ro: 'Scuzați-mă', es: 'Disculpe', fr: 'Excusez-moi', pt: 'Com licença', de: 'Entschuldigung', ru: 'Извините', uk: 'Вибачте', ja: 'すみません', ko: '실례합니다', zh: '打扰一下', ar: 'عذرا' },
  'qt-dont-understand': { ro: 'Nu înțeleg', es: 'No entiendo', fr: 'Je ne comprends pas', pt: 'Não entendo', de: 'Ich verstehe nicht', ru: 'Не понимаю', uk: 'Не розумію', ja: 'わかりません', ko: '모르겠어요', zh: '我不明白', ar: 'لا أفهم' },
  'qt-wait':          { ro: 'Așteaptă', es: 'Espera', fr: 'Attends', pt: 'Espere', de: 'Warte', ru: 'Подожди', uk: 'Зачекай', ja: '待って', ko: '기다려요', zh: '等一下', ar: 'انتظر' },
  'qt-come-here':     { ro: 'Vino aici', es: 'Ven aquí', fr: 'Viens ici', pt: 'Venha cá', de: 'Komm her', ru: 'Иди сюда', uk: 'Іди сюди', ja: 'こっちに来て', ko: '이리 와요', zh: '过来', ar: 'تعال هنا' },
  'qt-how-are-you':   { ro: 'Ce mai faci?', es: '¿Cómo estás?', fr: 'Comment ça va?', pt: 'Como vai?', de: 'Wie geht es dir?', ru: 'Как дела?', uk: 'Як справи?', ja: '元気ですか', ko: '어떻게 지내요?', zh: '你好吗', ar: 'كيف حالك؟' },
  'qt-im-good':       { ro: 'Sunt bine', es: 'Estoy bien', fr: 'Je vais bien', pt: 'Estou bem', de: 'Mir geht es gut', ru: 'Я хорошо', uk: 'Я добре', ja: '元気です', ko: '잘 지내요', zh: '我很好', ar: 'أنا بخير' },
  'qt-sorry':         { ro: 'Îmi pare rău', es: 'Lo siento', fr: 'Désolé', pt: 'Desculpe', de: 'Entschuldigung', ru: 'Извини', uk: 'Вибач', ja: 'ごめんなさい', ko: '미안해요', zh: '对不起', ar: 'آسف' },
  'qt-i-dont-know':   { ro: 'Nu știu', es: 'No sé', fr: 'Je ne sais pas', pt: 'Não sei', de: 'Ich weiß nicht', ru: 'Не знаю', uk: 'Не знаю', ja: 'わからない', ko: '몰라요', zh: '我不知道', ar: 'لا أعرف' },
  'qt-my-name':       { ro: 'Mă numesc', es: 'Me llamo', fr: 'Je m\'appelle', pt: 'Meu nome é', de: 'Ich heiße', ru: 'Меня зовут', uk: 'Мене звати', ja: '私の名前は', ko: '제 이름은', zh: '我叫', ar: 'اسمي' },
  'qt-nice-meet':     { ro: 'Încântat de cunoștință', es: 'Mucho gusto', fr: 'Enchanté', pt: 'Prazer em conhecer', de: 'Freut mich', ru: 'Приятно познакомиться', uk: 'Приємно познайомитися', ja: 'はじめまして', ko: '만나서 반가워요', zh: '很高兴认识你', ar: 'تشرفنا' },
  'qt-see-later':     { ro: 'Ne vedem', es: 'Hasta luego', fr: 'À plus tard', pt: 'Até logo', de: 'Bis später', ru: 'Увидимся', uk: 'Побачимось', ja: 'またね', ko: '나중에 봐요', zh: '回头见', ar: 'أراك لاحقا' },
  'qt-youre-welcome': { ro: 'Cu plăcere', es: 'De nada', fr: 'De rien', pt: 'De nada', de: 'Bitte schön', ru: 'Пожалуйста', uk: 'Будь ласка', ja: 'どういたしまして', ko: '천만에요', zh: '不客气', ar: 'على الرحب' },

  // Feelings
  'fe-happy':      { ro: 'Fericit', es: 'Feliz', fr: 'Content', pt: 'Feliz', de: 'Glücklich', ru: 'Счастливый', uk: 'Щасливий', ja: 'うれしい', ko: '행복해요', zh: '开心', ar: 'سعيد' },
  'fe-sad':        { ro: 'Trist', es: 'Triste', fr: 'Triste', pt: 'Triste', de: 'Traurig', ru: 'Грустный', uk: 'Сумний', ja: '悲しい', ko: '슬퍼요', zh: '难过', ar: 'حزين' },
  'fe-angry':      { ro: 'Supărat', es: 'Enojado', fr: 'En colère', pt: 'Com raiva', de: 'Wütend', ru: 'Злой', uk: 'Злий', ja: '怒っている', ko: '화나요', zh: '生气', ar: 'غاضب' },
  'fe-scared':     { ro: 'Speriat', es: 'Asustado', fr: 'Effrayé', pt: 'Assustado', de: 'Ängstlich', ru: 'Испуганный', uk: 'Наляканий', ja: '怖い', ko: '무서워요', zh: '害怕', ar: 'خائف' },
  'fe-excited':    { ro: 'Entuziasmat', es: 'Emocionado', fr: 'Excité', pt: 'Animado', de: 'Aufgeregt', ru: 'Взволнованный', uk: 'Схвильований', ja: 'わくわく', ko: '신나요', zh: '兴奋', ar: 'متحمس' },
  'fe-frustrated': { ro: 'Frustrat', es: 'Frustrado', fr: 'Frustré', pt: 'Frustrado', de: 'Frustriert', ru: 'Расстроенный', uk: 'Розчарований', ja: 'イライラ', ko: '답답해요', zh: '沮丧', ar: 'محبط' },
  'fe-bored':      { ro: 'Plictisit', es: 'Aburrido', fr: 'Ennuyé', pt: 'Entediado', de: 'Gelangweilt', ru: 'Скучно', uk: 'Нудно', ja: 'つまらない', ko: '지루해요', zh: '无聊', ar: 'ملل' },
  'fe-surprised':  { ro: 'Surprins', es: 'Sorprendido', fr: 'Surpris', pt: 'Surpreso', de: 'Überrascht', ru: 'Удивлённый', uk: 'Здивований', ja: 'びっくり', ko: '놀랐어요', zh: '惊讶', ar: 'متفاجئ' },
  'fe-confused':   { ro: 'Confuz', es: 'Confundido', fr: 'Confus', pt: 'Confuso', de: 'Verwirrt', ru: 'Растерянный', uk: 'Розгублений', ja: '困っている', ko: '헷갈려요', zh: '困惑', ar: 'مرتبك' },
  'fe-proud':      { ro: 'Mândru', es: 'Orgulloso', fr: 'Fier', pt: 'Orgulhoso', de: 'Stolz', ru: 'Гордый', uk: 'Гордий', ja: '誇らしい', ko: '자랑스러워요', zh: '骄傲', ar: 'فخور' },
  'fe-nervous':    { ro: 'Nervos', es: 'Nervioso', fr: 'Nerveux', pt: 'Nervoso', de: 'Nervös', ru: 'Нервный', uk: 'Нервовий', ja: '緊張している', ko: '긴장돼요', zh: '紧张', ar: 'متوتر' },
  'fe-silly':      { ro: 'Jucăuș', es: 'Tonto', fr: 'Bête', pt: 'Bobo', de: 'Albern', ru: 'Глупый', uk: 'Дурний', ja: 'おかしい', ko: '바보같아요', zh: '傻傻的', ar: 'سخيف' },
  'fe-love':       { ro: 'Te iubesc', es: 'Te quiero', fr: "Je t'aime", pt: 'Eu te amo', de: 'Ich liebe dich', ru: 'Я тебя люблю', uk: 'Я тебе люблю', ja: '大好き', ko: '사랑해요', zh: '我爱你', ar: 'أحبك' },
  'fe-hurt':       { ro: 'Sunt rănit', es: 'Me lastimaron', fr: "J'ai de la peine", pt: 'Estou magoado', de: 'Ich bin verletzt', ru: 'Мне обидно', uk: 'Мені прикро', ja: '傷ついた', ko: '마음이 아파요', zh: '我受伤了', ar: 'مشاعري متألمة' },

  // Actions
  'ac-go':    { ro: 'Du-te', es: 'Ir', fr: 'Aller', pt: 'Ir', de: 'Gehen', ru: 'Идти', uk: 'Іти', ja: '行く', ko: '가요', zh: '去', ar: 'اذهب' },
  'ac-stop':  { ro: 'Oprește', es: 'Parar', fr: 'Arrêter', pt: 'Parar', de: 'Stoppen', ru: 'Остановить', uk: 'Зупинити', ja: '止まる', ko: '멈춰요', zh: '停止', ar: 'توقف' },
  'ac-eat':   { ro: 'Mâncare', es: 'Comer', fr: 'Manger', pt: 'Comer', de: 'Essen', ru: 'Есть', uk: 'Їсти', ja: '食べる', ko: '먹어요', zh: '吃', ar: 'أكل' },
  'ac-drink': { ro: 'Bea', es: 'Beber', fr: 'Boire', pt: 'Beber', de: 'Trinken', ru: 'Пить', uk: 'Пити', ja: '飲む', ko: '마셔요', zh: '喝', ar: 'اشرب' },
  'ac-play':  { ro: 'Joacă', es: 'Jugar', fr: 'Jouer', pt: 'Brincar', de: 'Spielen', ru: 'Играть', uk: 'Грати', ja: '遊ぶ', ko: '놀아요', zh: '玩', ar: 'العب' },
  'ac-read':  { ro: 'Citește', es: 'Leer', fr: 'Lire', pt: 'Ler', de: 'Lesen', ru: 'Читать', uk: 'Читати', ja: '読む', ko: '읽어요', zh: '读', ar: 'اقرأ' },
  'ac-watch': { ro: 'Privește', es: 'Mirar', fr: 'Regarder', pt: 'Assistir', de: 'Schauen', ru: 'Смотреть', uk: 'Дивитися', ja: '見る', ko: '봐요', zh: '看', ar: 'شاهد' },
  'ac-listen':{ ro: 'Ascultă', es: 'Escuchar', fr: 'Écouter', pt: 'Ouvir', de: 'Hören', ru: 'Слушать', uk: 'Слухати', ja: '聞く', ko: '들어요', zh: '听', ar: 'استمع' },
  'ac-open':  { ro: 'Deschide', es: 'Abrir', fr: 'Ouvrir', pt: 'Abrir', de: 'Öffnen', ru: 'Открыть', uk: 'Відкрити', ja: '開ける', ko: '열어요', zh: '打开', ar: 'افتح' },
  'ac-close': { ro: 'Închide', es: 'Cerrar', fr: 'Fermer', pt: 'Fechar', de: 'Schließen', ru: 'Закрыть', uk: 'Закрити', ja: '閉める', ko: '닫아요', zh: '关', ar: 'أغلق' },
  'ac-give':  { ro: 'Dă', es: 'Dar', fr: 'Donner', pt: 'Dar', de: 'Geben', ru: 'Дать', uk: 'Дати', ja: 'あげる', ko: '줘요', zh: '给', ar: 'أعطِ' },
  'ac-take':  { ro: 'Ia', es: 'Tomar', fr: 'Prendre', pt: 'Pegar', de: 'Nehmen', ru: 'Взять', uk: 'Взяти', ja: '取る', ko: '가져요', zh: '拿', ar: 'خذ' },
  'ac-look':  { ro: 'Privește', es: 'Mira', fr: 'Regarde', pt: 'Olhe', de: 'Schau', ru: 'Смотри', uk: 'Дивись', ja: '見て', ko: '봐요', zh: '看看', ar: 'انظر' },
  'ac-sit':   { ro: 'Stai jos', es: 'Siéntate', fr: 'Assieds-toi', pt: 'Sente', de: 'Setz dich', ru: 'Сядь', uk: 'Сядь', ja: '座って', ko: '앉아요', zh: '坐', ar: 'اجلس' },
  'ac-stand': { ro: 'Ridică-te', es: 'Levántate', fr: 'Lève-toi', pt: 'Levante', de: 'Steh auf', ru: 'Встань', uk: 'Встань', ja: '立って', ko: '일어나요', zh: '站起来', ar: 'قف' },
  'ac-walk':  { ro: 'Mergi', es: 'Caminar', fr: 'Marcher', pt: 'Andar', de: 'Gehen', ru: 'Ходить', uk: 'Ходити', ja: '歩く', ko: '걸어요', zh: '走', ar: 'امشِ' },
  'ac-run':   { ro: 'Aleargă', es: 'Correr', fr: 'Courir', pt: 'Correr', de: 'Rennen', ru: 'Бежать', uk: 'Бігти', ja: '走る', ko: '달려요', zh: '跑', ar: 'اركض' },
  'ac-write': { ro: 'Scrie', es: 'Escribir', fr: 'Écrire', pt: 'Escrever', de: 'Schreiben', ru: 'Писать', uk: 'Писати', ja: '書く', ko: '써요', zh: '写', ar: 'اكتب' },
  'ac-draw':  { ro: 'Desenează', es: 'Dibujar', fr: 'Dessiner', pt: 'Desenhar', de: 'Zeichnen', ru: 'Рисовать', uk: 'Малювати', ja: '描く', ko: '그려요', zh: '画', ar: 'ارسم' },
  'ac-make':  { ro: 'Fă', es: 'Hacer', fr: 'Faire', pt: 'Fazer', de: 'Machen', ru: 'Делать', uk: 'Робити', ja: '作る', ko: '만들어요', zh: '做', ar: 'اصنع' },
  'ac-put':   { ro: 'Pune', es: 'Poner', fr: 'Mettre', pt: 'Colocar', de: 'Legen', ru: 'Положить', uk: 'Покласти', ja: '置く', ko: '놔요', zh: '放', ar: 'ضع' },
  'ac-get':   { ro: 'Ia', es: 'Conseguir', fr: 'Obtenir', pt: 'Pegar', de: 'Holen', ru: 'Взять', uk: 'Взяти', ja: '取って', ko: '가져와요', zh: '拿来', ar: 'احصل' },
  'ac-turn':  { ro: 'Întoarce', es: 'Girar', fr: 'Tourner', pt: 'Virar', de: 'Drehen', ru: 'Повернуть', uk: 'Повернути', ja: '回す', ko: '돌려요', zh: '转', ar: 'ادر' },
  'ac-wash':  { ro: 'Spală', es: 'Lavar', fr: 'Laver', pt: 'Lavar', de: 'Waschen', ru: 'Мыть', uk: 'Мити', ja: '洗う', ko: '씻어요', zh: '洗', ar: 'اغسل' },

  // Describing Words
  'dw-big':       { ro: 'Mare', es: 'Grande', fr: 'Grand', pt: 'Grande', de: 'Groß', ru: 'Большой', uk: 'Великий', ja: '大きい', ko: '커요', zh: '大', ar: 'كبير' },
  'dw-small':     { ro: 'Mic', es: 'Pequeño', fr: 'Petit', pt: 'Pequeno', de: 'Klein', ru: 'Маленький', uk: 'Малий', ja: '小さい', ko: '작아요', zh: '小', ar: 'صغير' },
  'dw-hot':       { ro: 'Fierbinte', es: 'Caliente', fr: 'Chaud', pt: 'Quente', de: 'Heiß', ru: 'Горячий', uk: 'Гарячий', ja: '暑い', ko: '뜨거워요', zh: '热', ar: 'حار' },
  'dw-cold':      { ro: 'Rece', es: 'Frío', fr: 'Froid', pt: 'Frio', de: 'Kalt', ru: 'Холодный', uk: 'Холодний', ja: '寒い', ko: '추워요', zh: '冷', ar: 'بارد' },
  'dw-good':      { ro: 'Bun', es: 'Bueno', fr: 'Bon', pt: 'Bom', de: 'Gut', ru: 'Хороший', uk: 'Гарний', ja: 'いい', ko: '좋아요', zh: '好', ar: 'جيد' },
  'dw-bad':       { ro: 'Rău', es: 'Malo', fr: 'Mauvais', pt: 'Mau', de: 'Schlecht', ru: 'Плохой', uk: 'Поганий', ja: '悪い', ko: '나빠요', zh: '坏', ar: 'سيء' },
  'dw-fast':      { ro: 'Rapid', es: 'Rápido', fr: 'Rapide', pt: 'Rápido', de: 'Schnell', ru: 'Быстрый', uk: 'Швидкий', ja: '速い', ko: '빨라요', zh: '快', ar: 'سريع' },
  'dw-slow':      { ro: 'Lent', es: 'Lento', fr: 'Lent', pt: 'Devagar', de: 'Langsam', ru: 'Медленный', uk: 'Повільний', ja: '遅い', ko: '느려요', zh: '慢', ar: 'بطيء' },
  'dw-new':       { ro: 'Nou', es: 'Nuevo', fr: 'Nouveau', pt: 'Novo', de: 'Neu', ru: 'Новый', uk: 'Новий', ja: '新しい', ko: '새로워요', zh: '新', ar: 'جديد' },
  'dw-old':       { ro: 'Vechi', es: 'Viejo', fr: 'Vieux', pt: 'Velho', de: 'Alt', ru: 'Старый', uk: 'Старий', ja: '古い', ko: '오래됐어요', zh: '旧', ar: 'قديم' },
  'dw-same':      { ro: 'La fel', es: 'Igual', fr: 'Pareil', pt: 'Igual', de: 'Gleich', ru: 'Одинаковый', uk: 'Однаковий', ja: '同じ', ko: '같아요', zh: '一样', ar: 'نفس الشيء' },
  'dw-different': { ro: 'Diferit', es: 'Diferente', fr: 'Différent', pt: 'Diferente', de: 'Anders', ru: 'Другой', uk: 'Інший', ja: '違う', ko: '달라요', zh: '不同', ar: 'مختلف' },
  'dw-funny':     { ro: 'Amuzant', es: 'Divertido', fr: 'Drôle', pt: 'Engraçado', de: 'Lustig', ru: 'Смешной', uk: 'Смішний', ja: 'おもしろい', ko: '재밌어요', zh: '有趣', ar: 'مضحك' },
  'dw-pretty':    { ro: 'Frumos', es: 'Bonito', fr: 'Joli', pt: 'Bonito', de: 'Hübsch', ru: 'Красивый', uk: 'Гарний', ja: 'きれい', ko: '예뻐요', zh: '漂亮', ar: 'جميل' },
  'dw-yucky':     { ro: 'Scârbos', es: 'Asqueroso', fr: 'Dégoûtant', pt: 'Nojento', de: 'Eklig', ru: 'Противный', uk: 'Огидний', ja: '気持ち悪い', ko: '더러워요', zh: '恶心', ar: 'مقرف' },
  'dw-favorite':  { ro: 'Preferat', es: 'Favorito', fr: 'Préféré', pt: 'Favorito', de: 'Lieblings-', ru: 'Любимый', uk: 'Улюблений', ja: 'お気に入り', ko: '좋아하는', zh: '最喜欢', ar: 'مفضل' },

  // Questions
  'qu-what':       { ro: 'Ce?', es: '¿Qué?', fr: 'Quoi?', pt: 'O quê?', de: 'Was?', ru: 'Что?', uk: 'Що?', ja: '何?', ko: '뭐예요?', zh: '什么?', ar: 'ماذا؟' },
  'qu-where':      { ro: 'Unde?', es: '¿Dónde?', fr: 'Où?', pt: 'Onde?', de: 'Wo?', ru: 'Где?', uk: 'Де?', ja: 'どこ?', ko: '어디예요?', zh: '在哪?', ar: 'أين؟' },
  'qu-when':       { ro: 'Când?', es: '¿Cuándo?', fr: 'Quand?', pt: 'Quando?', de: 'Wann?', ru: 'Когда?', uk: 'Коли?', ja: 'いつ?', ko: '언제예요?', zh: '什么时候?', ar: 'متى؟' },
  'qu-who':        { ro: 'Cine?', es: '¿Quién?', fr: 'Qui?', pt: 'Quem?', de: 'Wer?', ru: 'Кто?', uk: 'Хто?', ja: '誰?', ko: '누구예요?', zh: '谁?', ar: 'من؟' },
  'qu-why':        { ro: 'De ce?', es: '¿Por qué?', fr: 'Pourquoi?', pt: 'Por quê?', de: 'Warum?', ru: 'Почему?', uk: 'Чому?', ja: 'なぜ?', ko: '왜요?', zh: '为什么?', ar: 'لماذا؟' },
  'qu-how':        { ro: 'Cum?', es: '¿Cómo?', fr: 'Comment?', pt: 'Como?', de: 'Wie?', ru: 'Как?', uk: 'Як?', ja: 'どう?', ko: '어떻게요?', zh: '怎么?', ar: 'كيف؟' },
  'qu-which':      { ro: 'Care?', es: '¿Cuál?', fr: 'Lequel?', pt: 'Qual?', de: 'Welches?', ru: 'Какой?', uk: 'Який?', ja: 'どれ?', ko: '어느 거예요?', zh: '哪个?', ar: 'أيهم؟' },
  'qu-how-many':   { ro: 'Câte?', es: '¿Cuántos?', fr: 'Combien?', pt: 'Quantos?', de: 'Wie viele?', ru: 'Сколько?', uk: 'Скільки?', ja: 'いくつ?', ko: '몇 개예요?', zh: '多少?', ar: 'كم؟' },
  'qu-can-i':      { ro: 'Pot?', es: '¿Puedo?', fr: 'Puis-je?', pt: 'Posso?', de: 'Darf ich?', ru: 'Можно?', uk: 'Можна?', ja: 'いい?', ko: '해도 돼요?', zh: '可以吗?', ar: 'هل يمكنني؟' },
  'qu-is-it':      { ro: 'Este?', es: '¿Es?', fr: 'Est-ce?', pt: 'É?', de: 'Ist es?', ru: 'Это?', uk: 'Це?', ja: 'ですか?', ko: '맞아요?', zh: '是吗?', ar: 'هل هو؟' },
  'qu-whats-that':  { ro: 'Ce e asta?', es: '¿Qué es eso?', fr: "C'est quoi?", pt: 'O que é isso?', de: 'Was ist das?', ru: 'Что это?', uk: 'Що це?', ja: 'それは何?', ko: '그게 뭐예요?', zh: '那是什么?', ar: 'ما هذا؟' },
  'qu-where-going': { ro: 'Unde mergem?', es: '¿A dónde vamos?', fr: 'Où on va?', pt: 'Para onde vamos?', de: 'Wohin gehen wir?', ru: 'Куда мы идём?', uk: 'Куди ми йдемо?', ja: 'どこに行く?', ko: '어디 가요?', zh: '我们去哪?', ar: 'إلى أين نحن ذاهبون؟' },

  // People
  'pp-mom':       { ro: 'Mama', es: 'Mamá', fr: 'Maman', pt: 'Mamãe', de: 'Mama', ru: 'Мама', uk: 'Мама', ja: 'ママ', ko: '엄마', zh: '妈妈', ar: 'ماما' },
  'pp-dad':       { ro: 'Tata', es: 'Papá', fr: 'Papa', pt: 'Papai', de: 'Papa', ru: 'Папа', uk: 'Тато', ja: 'パパ', ko: '아빠', zh: '爸爸', ar: 'بابا' },
  'pp-teacher':   { ro: 'Profesor', es: 'Maestro', fr: 'Professeur', pt: 'Professor', de: 'Lehrer', ru: 'Учитель', uk: 'Вчитель', ja: '先生', ko: '선생님', zh: '老师', ar: 'معلم' },
  'pp-friend':    { ro: 'Prieten', es: 'Amigo', fr: 'Ami', pt: 'Amigo', de: 'Freund', ru: 'Друг', uk: 'Друг', ja: '友達', ko: '친구', zh: '朋友', ar: 'صديق' },
  'pp-family':    { ro: 'Familie', es: 'Familia', fr: 'Famille', pt: 'Família', de: 'Familie', ru: 'Семья', uk: 'Сім\'я', ja: '家族', ko: '가족', zh: '家人', ar: 'عائلة' },
  'pp-doctor':    { ro: 'Doctor', es: 'Doctor', fr: 'Docteur', pt: 'Médico', de: 'Arzt', ru: 'Врач', uk: 'Лікар', ja: '医者', ko: '의사', zh: '医生', ar: 'طبيب' },
  'pp-brother':   { ro: 'Frate', es: 'Hermano', fr: 'Frère', pt: 'Irmão', de: 'Bruder', ru: 'Брат', uk: 'Брат', ja: 'お兄ちゃん', ko: '형/오빠', zh: '哥哥', ar: 'أخ' },
  'pp-sister':    { ro: 'Soră', es: 'Hermana', fr: 'Sœur', pt: 'Irmã', de: 'Schwester', ru: 'Сестра', uk: 'Сестра', ja: 'お姉ちゃん', ko: '언니/누나', zh: '姐姐', ar: 'أخت' },
  'pp-grandma':   { ro: 'Bunica', es: 'Abuela', fr: 'Grand-mère', pt: 'Avó', de: 'Oma', ru: 'Бабушка', uk: 'Бабуся', ja: 'おばあちゃん', ko: '할머니', zh: '奶奶', ar: 'جدة' },
  'pp-grandpa':   { ro: 'Bunicul', es: 'Abuelo', fr: 'Grand-père', pt: 'Avô', de: 'Opa', ru: 'Дедушка', uk: 'Дідусь', ja: 'おじいちゃん', ko: '할아버지', zh: '爷爷', ar: 'جد' },
  'pp-baby':      { ro: 'Bebeluș', es: 'Bebé', fr: 'Bébé', pt: 'Bebê', de: 'Baby', ru: 'Малыш', uk: 'Малюк', ja: '赤ちゃん', ko: '아기', zh: '宝宝', ar: 'طفل' },
  'pp-boy':       { ro: 'Băiat', es: 'Niño', fr: 'Garçon', pt: 'Menino', de: 'Junge', ru: 'Мальчик', uk: 'Хлопчик', ja: '男の子', ko: '남자아이', zh: '男孩', ar: 'ولد' },
  'pp-girl':      { ro: 'Fată', es: 'Niña', fr: 'Fille', pt: 'Menina', de: 'Mädchen', ru: 'Девочка', uk: 'Дівчинка', ja: '女の子', ko: '여자아이', zh: '女孩', ar: 'بنت' },
  'pp-therapist': { ro: 'Terapeut', es: 'Terapeuta', fr: 'Thérapeute', pt: 'Terapeuta', de: 'Therapeut', ru: 'Терапевт', uk: 'Терапевт', ja: 'セラピスト', ko: '치료사', zh: '治疗师', ar: 'معالج' },

  // Food & Drink
  'fd-water':     { ro: 'Apă', es: 'Agua', fr: 'Eau', pt: 'Água', de: 'Wasser', ru: 'Вода', uk: 'Вода', ja: '水', ko: '물', zh: '水', ar: 'ماء' },
  'fd-juice':     { ro: 'Suc', es: 'Jugo', fr: 'Jus', pt: 'Suco', de: 'Saft', ru: 'Сок', uk: 'Сік', ja: 'ジュース', ko: '주스', zh: '果汁', ar: 'عصير' },
  'fd-milk':      { ro: 'Lapte', es: 'Leche', fr: 'Lait', pt: 'Leite', de: 'Milch', ru: 'Молоко', uk: 'Молоко', ja: '牛乳', ko: '우유', zh: '牛奶', ar: 'حليب' },
  'fd-pizza':     { ro: 'Pizza', es: 'Pizza', fr: 'Pizza', pt: 'Pizza', de: 'Pizza', ru: 'Пицца', uk: 'Піца', ja: 'ピザ', ko: '피자', zh: '披萨', ar: 'بيتزا' },
  'fd-sandwich':  { ro: 'Sandviș', es: 'Sándwich', fr: 'Sandwich', pt: 'Sanduíche', de: 'Sandwich', ru: 'Сэндвич', uk: 'Сендвіч', ja: 'サンドイッチ', ko: '샌드위치', zh: '三明治', ar: 'ساندويتش' },
  'fd-chicken':   { ro: 'Pui', es: 'Pollo', fr: 'Poulet', pt: 'Frango', de: 'Hähnchen', ru: 'Курица', uk: 'Курка', ja: 'チキン', ko: '치킨', zh: '鸡肉', ar: 'دجاج' },
  'fd-fries':     { ro: 'Cartofi prăjiți', es: 'Papas fritas', fr: 'Frites', pt: 'Batata frita', de: 'Pommes', ru: 'Картошка фри', uk: 'Картопля фрі', ja: 'フライドポテト', ko: '감자튀김', zh: '薯条', ar: 'بطاطس مقلية' },
  'fd-fruit':     { ro: 'Fructe', es: 'Fruta', fr: 'Fruit', pt: 'Fruta', de: 'Obst', ru: 'Фрукты', uk: 'Фрукти', ja: '果物', ko: '과일', zh: '水果', ar: 'فواكه' },
  'fd-snack':     { ro: 'Gustare', es: 'Bocadillo', fr: 'Goûter', pt: 'Lanche', de: 'Snack', ru: 'Перекус', uk: 'Перекус', ja: 'おやつ', ko: '간식', zh: '零食', ar: 'وجبة خفيفة' },
  'fd-more':      { ro: 'Mai mult te rog', es: 'Más por favor', fr: 'Encore svp', pt: 'Mais por favor', de: 'Mehr bitte', ru: 'Ещё пожалуйста', uk: 'Ще будь ласка', ja: 'もっとください', ko: '더 주세요', zh: '再来点', ar: 'المزيد من فضلك' },
  'fd-no-thanks': { ro: 'Nu mulțumesc', es: 'No gracias', fr: 'Non merci', pt: 'Não obrigado', de: 'Nein danke', ru: 'Нет спасибо', uk: 'Ні дякую', ja: 'いりません', ko: '괜찮아요', zh: '不用了', ar: 'لا شكرا' },
  'fd-cookie':    { ro: 'Biscuit', es: 'Galleta', fr: 'Biscuit', pt: 'Biscoito', de: 'Keks', ru: 'Печенье', uk: 'Печиво', ja: 'クッキー', ko: '쿠키', zh: '饼干', ar: 'بسكويت' },
  'fd-apple':     { ro: 'Măr', es: 'Manzana', fr: 'Pomme', pt: 'Maçã', de: 'Apfel', ru: 'Яблоко', uk: 'Яблуко', ja: 'りんご', ko: '사과', zh: '苹果', ar: 'تفاحة' },
  'fd-banana':    { ro: 'Banană', es: 'Plátano', fr: 'Banane', pt: 'Banana', de: 'Banane', ru: 'Банан', uk: 'Банан', ja: 'バナナ', ko: '바나나', zh: '香蕉', ar: 'موز' },
  'fd-cereal':    { ro: 'Cereale', es: 'Cereal', fr: 'Céréales', pt: 'Cereal', de: 'Müsli', ru: 'Каша', uk: 'Каша', ja: 'シリアル', ko: '시리얼', zh: '麦片', ar: 'حبوب' },
  'fd-cheese':    { ro: 'Brânză', es: 'Queso', fr: 'Fromage', pt: 'Queijo', de: 'Käse', ru: 'Сыр', uk: 'Сир', ja: 'チーズ', ko: '치즈', zh: '奶酪', ar: 'جبنة' },
  'fd-ice-cream': { ro: 'Înghețată', es: 'Helado', fr: 'Glace', pt: 'Sorvete', de: 'Eis', ru: 'Мороженое', uk: 'Морозиво', ja: 'アイス', ko: '아이스크림', zh: '冰淇淋', ar: 'آيس كريم' },
  'fd-crackers':  { ro: 'Biscuiți', es: 'Galletas', fr: 'Crackers', pt: 'Bolachas', de: 'Cracker', ru: 'Крекеры', uk: 'Крекери', ja: 'クラッカー', ko: '크래커', zh: '饼干', ar: 'مقرمشات' },

  // Places
  'pl-home':       { ro: 'Acasă', es: 'Casa', fr: 'Maison', pt: 'Casa', de: 'Zuhause', ru: 'Дом', uk: 'Дім', ja: '家', ko: '집', zh: '家', ar: 'بيت' },
  'pl-school':     { ro: 'Școală', es: 'Escuela', fr: 'École', pt: 'Escola', de: 'Schule', ru: 'Школа', uk: 'Школа', ja: '学校', ko: '학교', zh: '学校', ar: 'مدرسة' },
  'pl-park':       { ro: 'Parc', es: 'Parque', fr: 'Parc', pt: 'Parque', de: 'Park', ru: 'Парк', uk: 'Парк', ja: '公園', ko: '공원', zh: '公园', ar: 'حديقة' },
  'pl-store':      { ro: 'Magazin', es: 'Tienda', fr: 'Magasin', pt: 'Loja', de: 'Laden', ru: 'Магазин', uk: 'Магазин', ja: 'お店', ko: '가게', zh: '商店', ar: 'متجر' },
  'pl-restaurant': { ro: 'Restaurant', es: 'Restaurante', fr: 'Restaurant', pt: 'Restaurante', de: 'Restaurant', ru: 'Ресторан', uk: 'Ресторан', ja: 'レストラン', ko: '식당', zh: '餐厅', ar: 'مطعم' },
  'pl-library':    { ro: 'Bibliotecă', es: 'Biblioteca', fr: 'Bibliothèque', pt: 'Biblioteca', de: 'Bibliothek', ru: 'Библиотека', uk: 'Бібліотека', ja: '図書館', ko: '도서관', zh: '图书馆', ar: 'مكتبة' },
  'pl-pool':       { ro: 'Piscină', es: 'Piscina', fr: 'Piscine', pt: 'Piscina', de: 'Schwimmbad', ru: 'Бассейн', uk: 'Басейн', ja: 'プール', ko: '수영장', zh: '游泳池', ar: 'مسبح' },
  'pl-car':        { ro: 'Mașină', es: 'Carro', fr: 'Voiture', pt: 'Carro', de: 'Auto', ru: 'Машина', uk: 'Машина', ja: '車', ko: '자동차', zh: '车', ar: 'سيارة' },
  'pl-outside':    { ro: 'Afară', es: 'Afuera', fr: 'Dehors', pt: 'Fora', de: 'Draußen', ru: 'На улице', uk: 'Надворі', ja: '外', ko: '밖', zh: '外面', ar: 'خارج' },
  'pl-inside':     { ro: 'Înăuntru', es: 'Adentro', fr: 'Dedans', pt: 'Dentro', de: 'Drinnen', ru: 'Внутри', uk: 'Всередині', ja: '中', ko: '안', zh: '里面', ar: 'داخل' },
  'pl-bathroom':   { ro: 'Baie', es: 'Baño', fr: 'Salle de bain', pt: 'Banheiro', de: 'Badezimmer', ru: 'Ванная', uk: 'Ванна', ja: 'お風呂', ko: '욕실', zh: '浴室', ar: 'حمام' },
  'pl-bedroom':    { ro: 'Dormitor', es: 'Dormitorio', fr: 'Chambre', pt: 'Quarto', de: 'Schlafzimmer', ru: 'Спальня', uk: 'Спальня', ja: '寝室', ko: '침실', zh: '卧室', ar: 'غرفة نوم' },
  'pl-kitchen':    { ro: 'Bucătărie', es: 'Cocina', fr: 'Cuisine', pt: 'Cozinha', de: 'Küche', ru: 'Кухня', uk: 'Кухня', ja: '台所', ko: '부엌', zh: '厨房', ar: 'مطبخ' },
  'pl-playground': { ro: 'Loc de joacă', es: 'Patio', fr: 'Aire de jeux', pt: 'Parquinho', de: 'Spielplatz', ru: 'Площадка', uk: 'Майданчик', ja: '遊び場', ko: '놀이터', zh: '操场', ar: 'ملعب' },

  // School / Work
  'sw-class':     { ro: 'Clasă', es: 'Clase', fr: 'Classe', pt: 'Aula', de: 'Klasse', ru: 'Урок', uk: 'Урок', ja: '授業', ko: '수업', zh: '课', ar: 'صف' },
  'sw-homework':  { ro: 'Temă', es: 'Tarea', fr: 'Devoirs', pt: 'Dever', de: 'Hausaufgaben', ru: 'Домашнее задание', uk: 'Домашнє завдання', ja: '宿題', ko: '숙제', zh: '作业', ar: 'واجب' },
  'sw-computer':  { ro: 'Calculator', es: 'Computadora', fr: 'Ordinateur', pt: 'Computador', de: 'Computer', ru: 'Компьютер', uk: 'Комп\'ютер', ja: 'パソコン', ko: '컴퓨터', zh: '电脑', ar: 'كمبيوتر' },
  'sw-book':      { ro: 'Carte', es: 'Libro', fr: 'Livre', pt: 'Livro', de: 'Buch', ru: 'Книга', uk: 'Книга', ja: '本', ko: '책', zh: '书', ar: 'كتاب' },
  'sw-pencil':    { ro: 'Creion', es: 'Lápiz', fr: 'Crayon', pt: 'Lápis', de: 'Bleistift', ru: 'Карандаш', uk: 'Олівець', ja: '鉛筆', ko: '연필', zh: '铅笔', ar: 'قلم رصاص' },
  'sw-question':  { ro: 'Am o întrebare', es: 'Tengo una pregunta', fr: "J'ai une question", pt: 'Tenho uma pergunta', de: 'Ich habe eine Frage', ru: 'У меня вопрос', uk: 'У мене питання', ja: '質問があります', ko: '질문이 있어요', zh: '我有个问题', ar: 'لدي سؤال' },
  'sw-finished':  { ro: 'Am terminat', es: 'Terminé', fr: "J'ai fini", pt: 'Terminei', de: 'Ich bin fertig', ru: 'Я закончил', uk: 'Я закінчив', ja: '終わった', ko: '끝났어요', zh: '我做完了', ar: 'انتهيت' },
  'sw-help':      { ro: 'Am nevoie de ajutor', es: 'Necesito ayuda', fr: "J'ai besoin d'aide", pt: 'Preciso de ajuda', de: 'Ich brauche Hilfe', ru: 'Мне нужна помощь', uk: 'Мені потрібна допомога', ja: '手伝ってください', ko: '도와주세요', zh: '我需要帮助', ar: 'أحتاج مساعدة' },
  'sw-paper':     { ro: 'Hârtie', es: 'Papel', fr: 'Papier', pt: 'Papel', de: 'Papier', ru: 'Бумага', uk: 'Папір', ja: '紙', ko: '종이', zh: '纸', ar: 'ورقة' },
  'sw-table':     { ro: 'Masă', es: 'Mesa', fr: 'Table', pt: 'Mesa', de: 'Tisch', ru: 'Стол', uk: 'Стіл', ja: 'テーブル', ko: '책상', zh: '桌子', ar: 'طاولة' },
  'sw-chair':     { ro: 'Scaun', es: 'Silla', fr: 'Chaise', pt: 'Cadeira', de: 'Stuhl', ru: 'Стул', uk: 'Стілець', ja: '椅子', ko: '의자', zh: '椅子', ar: 'كرسي' },
  'sw-art':       { ro: 'Artă', es: 'Arte', fr: 'Art', pt: 'Arte', de: 'Kunst', ru: 'Искусство', uk: 'Мистецтво', ja: '美術', ko: '미술', zh: '美术', ar: 'فن' },
  'sw-music':     { ro: 'Muzică', es: 'Música', fr: 'Musique', pt: 'Música', de: 'Musik', ru: 'Музыка', uk: 'Музика', ja: '音楽', ko: '음악', zh: '音乐', ar: 'موسيقى' },
  'sw-recess':    { ro: 'Pauză', es: 'Recreo', fr: 'Récréation', pt: 'Recreio', de: 'Pause', ru: 'Перемена', uk: 'Перерва', ja: '休み時間', ko: '쉬는 시간', zh: '课间', ar: 'استراحة' },

  // Health / Body — remaining categories use same pattern
  'hb-head':     { ro: 'Cap', es: 'Cabeza', fr: 'Tête', pt: 'Cabeça', de: 'Kopf', ru: 'Голова', uk: 'Голова', ja: '頭', ko: '머리', zh: '头', ar: 'رأس' },
  'hb-tummy':    { ro: 'Burtică', es: 'Barriga', fr: 'Ventre', pt: 'Barriga', de: 'Bauch', ru: 'Живот', uk: 'Живіт', ja: 'お腹', ko: '배', zh: '肚子', ar: 'بطن' },
  'hb-hand':     { ro: 'Mână', es: 'Mano', fr: 'Main', pt: 'Mão', de: 'Hand', ru: 'Рука', uk: 'Рука', ja: '手', ko: '손', zh: '手', ar: 'يد' },
  'hb-foot':     { ro: 'Picior', es: 'Pie', fr: 'Pied', pt: 'Pé', de: 'Fuß', ru: 'Нога', uk: 'Нога', ja: '足', ko: '발', zh: '脚', ar: 'قدم' },
  'hb-eye':      { ro: 'Ochi', es: 'Ojo', fr: 'Œil', pt: 'Olho', de: 'Auge', ru: 'Глаз', uk: 'Око', ja: '目', ko: '눈', zh: '眼睛', ar: 'عين' },
  'hb-ear':      { ro: 'Ureche', es: 'Oreja', fr: 'Oreille', pt: 'Orelha', de: 'Ohr', ru: 'Ухо', uk: 'Вухо', ja: '耳', ko: '귀', zh: '耳朵', ar: 'أذن' },
  'hb-mouth':    { ro: 'Gură', es: 'Boca', fr: 'Bouche', pt: 'Boca', de: 'Mund', ru: 'Рот', uk: 'Рот', ja: '口', ko: '입', zh: '嘴', ar: 'فم' },
  'hb-nose':     { ro: 'Nas', es: 'Nariz', fr: 'Nez', pt: 'Nariz', de: 'Nase', ru: 'Нос', uk: 'Ніс', ja: '鼻', ko: '코', zh: '鼻子', ar: 'أنف' },
  'hb-hurts':    { ro: 'Mă doare', es: 'Me duele', fr: "J'ai mal", pt: 'Dói', de: 'Es tut weh', ru: 'Больно', uk: 'Болить', ja: '痛い', ko: '아파요', zh: '疼', ar: 'يؤلم' },
  'hb-sick':     { ro: 'Mă simt rău', es: 'Me siento mal', fr: 'Je suis malade', pt: 'Estou doente', de: 'Mir ist schlecht', ru: 'Мне плохо', uk: 'Мені погано', ja: '気分が悪い', ko: '아프다', zh: '不舒服', ar: 'مريض' },
  'hb-medicine': { ro: 'Medicament', es: 'Medicina', fr: 'Médicament', pt: 'Remédio', de: 'Medizin', ru: 'Лекарство', uk: 'Ліки', ja: '薬', ko: '약', zh: '药', ar: 'دواء' },
  'hb-teeth':    { ro: 'Dinți', es: 'Dientes', fr: 'Dents', pt: 'Dentes', de: 'Zähne', ru: 'Зубы', uk: 'Зуби', ja: '歯', ko: '이', zh: '牙齿', ar: 'أسنان' },
  'hb-back':     { ro: 'Spate', es: 'Espalda', fr: 'Dos', pt: 'Costas', de: 'Rücken', ru: 'Спина', uk: 'Спина', ja: '背中', ko: '등', zh: '背', ar: 'ظهر' },
  'hb-arm':      { ro: 'Braț', es: 'Brazo', fr: 'Bras', pt: 'Braço', de: 'Arm', ru: 'Рука', uk: 'Рука', ja: '腕', ko: '팔', zh: '胳膊', ar: 'ذراع' },

  // Time
  'ti-now':       { ro: 'Acum', es: 'Ahora', fr: 'Maintenant', pt: 'Agora', de: 'Jetzt', ru: 'Сейчас', uk: 'Зараз', ja: '今', ko: '지금', zh: '现在', ar: 'الآن' },
  'ti-later':     { ro: 'Mai târziu', es: 'Después', fr: 'Plus tard', pt: 'Depois', de: 'Später', ru: 'Потом', uk: 'Пізніше', ja: '後で', ko: '나중에', zh: '以后', ar: 'لاحقا' },
  'ti-today':     { ro: 'Azi', es: 'Hoy', fr: "Aujourd'hui", pt: 'Hoje', de: 'Heute', ru: 'Сегодня', uk: 'Сьогодні', ja: '今日', ko: '오늘', zh: '今天', ar: 'اليوم' },
  'ti-tomorrow':  { ro: 'Mâine', es: 'Mañana', fr: 'Demain', pt: 'Amanhã', de: 'Morgen', ru: 'Завтра', uk: 'Завтра', ja: '明日', ko: '내일', zh: '明天', ar: 'غدا' },
  'ti-yesterday': { ro: 'Ieri', es: 'Ayer', fr: 'Hier', pt: 'Ontem', de: 'Gestern', ru: 'Вчера', uk: 'Вчора', ja: '昨日', ko: '어제', zh: '昨天', ar: 'أمس' },
  'ti-morning':   { ro: 'Dimineață', es: 'Mañana', fr: 'Matin', pt: 'Manhã', de: 'Morgen', ru: 'Утро', uk: 'Ранок', ja: '朝', ko: '아침', zh: '早上', ar: 'صباح' },
  'ti-afternoon': { ro: 'După-amiază', es: 'Tarde', fr: 'Après-midi', pt: 'Tarde', de: 'Nachmittag', ru: 'День', uk: 'День', ja: '午後', ko: '오후', zh: '下午', ar: 'بعد الظهر' },
  'ti-night':     { ro: 'Noapte', es: 'Noche', fr: 'Nuit', pt: 'Noite', de: 'Nacht', ru: 'Ночь', uk: 'Ніч', ja: '夜', ko: '밤', zh: '晚上', ar: 'ليل' },
  'ti-before':    { ro: 'Înainte', es: 'Antes', fr: 'Avant', pt: 'Antes', de: 'Vorher', ru: 'До', uk: 'До', ja: '前', ko: '전에', zh: '之前', ar: 'قبل' },
  'ti-after':     { ro: 'După', es: 'Después', fr: 'Après', pt: 'Depois', de: 'Nachher', ru: 'После', uk: 'Після', ja: '後', ko: '후에', zh: '之后', ar: 'بعد' },
  'ti-first':     { ro: 'Primul', es: 'Primero', fr: 'Premier', pt: 'Primeiro', de: 'Erster', ru: 'Первый', uk: 'Перший', ja: '最初', ko: '처음', zh: '第一', ar: 'أول' },
  'ti-last':      { ro: 'Ultimul', es: 'Último', fr: 'Dernier', pt: 'Último', de: 'Letzter', ru: 'Последний', uk: 'Останній', ja: '最後', ko: '마지막', zh: '最后', ar: 'آخر' },

  // Animals
  'an-dog':       { ro: 'Câine', es: 'Perro', fr: 'Chien', pt: 'Cachorro', de: 'Hund', ru: 'Собака', uk: 'Собака', ja: '犬', ko: '개', zh: '狗', ar: 'كلب' },
  'an-cat':       { ro: 'Pisică', es: 'Gato', fr: 'Chat', pt: 'Gato', de: 'Katze', ru: 'Кошка', uk: 'Кішка', ja: '猫', ko: '고양이', zh: '猫', ar: 'قطة' },
  'an-fish':      { ro: 'Pește', es: 'Pez', fr: 'Poisson', pt: 'Peixe', de: 'Fisch', ru: 'Рыба', uk: 'Риба', ja: '魚', ko: '물고기', zh: '鱼', ar: 'سمكة' },
  'an-bird':      { ro: 'Pasăre', es: 'Pájaro', fr: 'Oiseau', pt: 'Pássaro', de: 'Vogel', ru: 'Птица', uk: 'Птах', ja: '鳥', ko: '새', zh: '鸟', ar: 'عصفور' },
  'an-horse':     { ro: 'Cal', es: 'Caballo', fr: 'Cheval', pt: 'Cavalo', de: 'Pferd', ru: 'Лошадь', uk: 'Кінь', ja: '馬', ko: '말', zh: '马', ar: 'حصان' },
  'an-cow':       { ro: 'Vacă', es: 'Vaca', fr: 'Vache', pt: 'Vaca', de: 'Kuh', ru: 'Корова', uk: 'Корова', ja: '牛', ko: '소', zh: '牛', ar: 'بقرة' },
  'an-pig':       { ro: 'Porc', es: 'Cerdo', fr: 'Cochon', pt: 'Porco', de: 'Schwein', ru: 'Свинья', uk: 'Свиня', ja: '豚', ko: '돼지', zh: '猪', ar: 'خنزير' },
  'an-rabbit':    { ro: 'Iepure', es: 'Conejo', fr: 'Lapin', pt: 'Coelho', de: 'Hase', ru: 'Кролик', uk: 'Кролик', ja: 'うさぎ', ko: '토끼', zh: '兔子', ar: 'أرنب' },
  'an-bear':      { ro: 'Urs', es: 'Oso', fr: 'Ours', pt: 'Urso', de: 'Bär', ru: 'Медведь', uk: 'Ведмідь', ja: '熊', ko: '곰', zh: '熊', ar: 'دب' },
  'an-elephant':  { ro: 'Elefant', es: 'Elefante', fr: 'Éléphant', pt: 'Elefante', de: 'Elefant', ru: 'Слон', uk: 'Слон', ja: '象', ko: '코끼리', zh: '大象', ar: 'فيل' },
  'an-duck':      { ro: 'Rață', es: 'Pato', fr: 'Canard', pt: 'Pato', de: 'Ente', ru: 'Утка', uk: 'Качка', ja: 'あひる', ko: '오리', zh: '鸭子', ar: 'بطة' },
  'an-butterfly': { ro: 'Fluture', es: 'Mariposa', fr: 'Papillon', pt: 'Borboleta', de: 'Schmetterling', ru: 'Бабочка', uk: 'Метелик', ja: 'ちょうちょ', ko: '나비', zh: '蝴蝶', ar: 'فراشة' },

  // Colors
  'co-red':    { ro: 'Roșu', es: 'Rojo', fr: 'Rouge', pt: 'Vermelho', de: 'Rot', ru: 'Красный', uk: 'Червоний', ja: '赤', ko: '빨강', zh: '红色', ar: 'أحمر' },
  'co-blue':   { ro: 'Albastru', es: 'Azul', fr: 'Bleu', pt: 'Azul', de: 'Blau', ru: 'Синий', uk: 'Синій', ja: '青', ko: '파랑', zh: '蓝色', ar: 'أزرق' },
  'co-green':  { ro: 'Verde', es: 'Verde', fr: 'Vert', pt: 'Verde', de: 'Grün', ru: 'Зелёный', uk: 'Зелений', ja: '緑', ko: '초록', zh: '绿色', ar: 'أخضر' },
  'co-yellow': { ro: 'Galben', es: 'Amarillo', fr: 'Jaune', pt: 'Amarelo', de: 'Gelb', ru: 'Жёлтый', uk: 'Жовтий', ja: '黄色', ko: '노랑', zh: '黄色', ar: 'أصفر' },
  'co-orange': { ro: 'Portocaliu', es: 'Naranja', fr: 'Orange', pt: 'Laranja', de: 'Orange', ru: 'Оранжевый', uk: 'Помаранчевий', ja: 'オレンジ', ko: '주황', zh: '橙色', ar: 'برتقالي' },
  'co-purple': { ro: 'Mov', es: 'Morado', fr: 'Violet', pt: 'Roxo', de: 'Lila', ru: 'Фиолетовый', uk: 'Фіолетовий', ja: '紫', ko: '보라', zh: '紫色', ar: 'بنفسجي' },
  'co-pink':   { ro: 'Roz', es: 'Rosa', fr: 'Rose', pt: 'Rosa', de: 'Rosa', ru: 'Розовый', uk: 'Рожевий', ja: 'ピンク', ko: '분홍', zh: '粉色', ar: 'وردي' },
  'co-black':  { ro: 'Negru', es: 'Negro', fr: 'Noir', pt: 'Preto', de: 'Schwarz', ru: 'Чёрный', uk: 'Чорний', ja: '黒', ko: '검정', zh: '黑色', ar: 'أسود' },
  'co-white':  { ro: 'Alb', es: 'Blanco', fr: 'Blanc', pt: 'Branco', de: 'Weiß', ru: 'Белый', uk: 'Білий', ja: '白', ko: '흰색', zh: '白色', ar: 'أبيض' },
  'co-brown':  { ro: 'Maro', es: 'Marrón', fr: 'Marron', pt: 'Marrom', de: 'Braun', ru: 'Коричневый', uk: 'Коричневий', ja: '茶色', ko: '갈색', zh: '棕色', ar: 'بني' },

  // Clothes
  'cl-shirt':     { ro: 'Cămașă', es: 'Camisa', fr: 'Chemise', pt: 'Camisa', de: 'Hemd', ru: 'Рубашка', uk: 'Сорочка', ja: 'シャツ', ko: '셔츠', zh: '衬衫', ar: 'قميص' },
  'cl-pants':     { ro: 'Pantaloni', es: 'Pantalones', fr: 'Pantalon', pt: 'Calça', de: 'Hose', ru: 'Штаны', uk: 'Штани', ja: 'ズボン', ko: '바지', zh: '裤子', ar: 'بنطلون' },
  'cl-shoes':     { ro: 'Pantofi', es: 'Zapatos', fr: 'Chaussures', pt: 'Sapatos', de: 'Schuhe', ru: 'Обувь', uk: 'Взуття', ja: '靴', ko: '신발', zh: '鞋', ar: 'حذاء' },
  'cl-socks':     { ro: 'Șosete', es: 'Calcetines', fr: 'Chaussettes', pt: 'Meias', de: 'Socken', ru: 'Носки', uk: 'Шкарпетки', ja: '靴下', ko: '양말', zh: '袜子', ar: 'جوارب' },
  'cl-jacket':    { ro: 'Jachetă', es: 'Chaqueta', fr: 'Veste', pt: 'Jaqueta', de: 'Jacke', ru: 'Куртка', uk: 'Куртка', ja: 'ジャケット', ko: '재킷', zh: '夹克', ar: 'سترة' },
  'cl-hat':       { ro: 'Pălărie', es: 'Sombrero', fr: 'Chapeau', pt: 'Chapéu', de: 'Hut', ru: 'Шляпа', uk: 'Капелюх', ja: '帽子', ko: '모자', zh: '帽子', ar: 'قبعة' },
  'cl-dress':     { ro: 'Rochie', es: 'Vestido', fr: 'Robe', pt: 'Vestido', de: 'Kleid', ru: 'Платье', uk: 'Сукня', ja: 'ドレス', ko: '원피스', zh: '裙子', ar: 'فستان' },
  'cl-pajamas':   { ro: 'Pijama', es: 'Pijama', fr: 'Pyjama', pt: 'Pijama', de: 'Schlafanzug', ru: 'Пижама', uk: 'Піжама', ja: 'パジャマ', ko: '잠옷', zh: '睡衣', ar: 'بيجاما' },
  'cl-underwear': { ro: 'Lenjerie', es: 'Ropa interior', fr: 'Sous-vêtements', pt: 'Roupa íntima', de: 'Unterwäsche', ru: 'Бельё', uk: 'Білизна', ja: '下着', ko: '속옷', zh: '内衣', ar: 'ملابس داخلية' },
  'cl-boots':     { ro: 'Ghete', es: 'Botas', fr: 'Bottes', pt: 'Botas', de: 'Stiefel', ru: 'Сапоги', uk: 'Чоботи', ja: 'ブーツ', ko: '부츠', zh: '靴子', ar: 'أحذية' },

  // Transportation
  'tr-car':        { ro: 'Mașină', es: 'Carro', fr: 'Voiture', pt: 'Carro', de: 'Auto', ru: 'Машина', uk: 'Машина', ja: '車', ko: '자동차', zh: '车', ar: 'سيارة' },
  'tr-bus':        { ro: 'Autobuz', es: 'Autobús', fr: 'Bus', pt: 'Ônibus', de: 'Bus', ru: 'Автобус', uk: 'Автобус', ja: 'バス', ko: '버스', zh: '公交车', ar: 'حافلة' },
  'tr-train':      { ro: 'Tren', es: 'Tren', fr: 'Train', pt: 'Trem', de: 'Zug', ru: 'Поезд', uk: 'Потяг', ja: '電車', ko: '기차', zh: '火车', ar: 'قطار' },
  'tr-airplane':   { ro: 'Avion', es: 'Avión', fr: 'Avion', pt: 'Avião', de: 'Flugzeug', ru: 'Самолёт', uk: 'Літак', ja: '飛行機', ko: '비행기', zh: '飞机', ar: 'طائرة' },
  'tr-bike':       { ro: 'Bicicletă', es: 'Bicicleta', fr: 'Vélo', pt: 'Bicicleta', de: 'Fahrrad', ru: 'Велосипед', uk: 'Велосипед', ja: '自転車', ko: '자전거', zh: '自行车', ar: 'دراجة' },
  'tr-truck':      { ro: 'Camion', es: 'Camión', fr: 'Camion', pt: 'Caminhão', de: 'Lastwagen', ru: 'Грузовик', uk: 'Вантажівка', ja: 'トラック', ko: '트럭', zh: '卡车', ar: 'شاحنة' },
  'tr-boat':       { ro: 'Barcă', es: 'Barco', fr: 'Bateau', pt: 'Barco', de: 'Boot', ru: 'Лодка', uk: 'Човен', ja: '船', ko: '배', zh: '船', ar: 'قارب' },
  'tr-walk':       { ro: 'Mers pe jos', es: 'Caminar', fr: 'Marcher', pt: 'Andar', de: 'Gehen', ru: 'Пешком', uk: 'Пішки', ja: '歩く', ko: '걷기', zh: '步行', ar: 'مشي' },
  'tr-wheelchair': { ro: 'Scaun cu rotile', es: 'Silla de ruedas', fr: 'Fauteuil roulant', pt: 'Cadeira de rodas', de: 'Rollstuhl', ru: 'Инвалидная коляска', uk: 'Інвалідний візок', ja: '車椅子', ko: '휠체어', zh: '轮椅', ar: 'كرسي متحرك' },
  'tr-scooter':    { ro: 'Trotinetă', es: 'Patinete', fr: 'Trottinette', pt: 'Patinete', de: 'Roller', ru: 'Самокат', uk: 'Самокат', ja: 'スクーター', ko: '킥보드', zh: '滑板车', ar: 'سكوتر' },

  // Weather
  'we-sunny':  { ro: 'Însorit', es: 'Soleado', fr: 'Ensoleillé', pt: 'Ensolarado', de: 'Sonnig', ru: 'Солнечно', uk: 'Сонячно', ja: '晴れ', ko: '맑아요', zh: '晴天', ar: 'مشمس' },
  'we-rainy':  { ro: 'Ploios', es: 'Lluvioso', fr: 'Pluvieux', pt: 'Chuvoso', de: 'Regnerisch', ru: 'Дождливо', uk: 'Дощовий', ja: '雨', ko: '비와요', zh: '下雨', ar: 'ممطر' },
  'we-cloudy': { ro: 'Noros', es: 'Nublado', fr: 'Nuageux', pt: 'Nublado', de: 'Bewölkt', ru: 'Облачно', uk: 'Хмарно', ja: '曇り', ko: '흐려요', zh: '多云', ar: 'غائم' },
  'we-snowy':  { ro: 'Ninsoare', es: 'Nevado', fr: 'Neigeux', pt: 'Nevando', de: 'Schnee', ru: 'Снежно', uk: 'Сніжно', ja: '雪', ko: '눈와요', zh: '下雪', ar: 'ثلجي' },
  'we-windy':  { ro: 'Vânt', es: 'Ventoso', fr: 'Venteux', pt: 'Ventoso', de: 'Windig', ru: 'Ветрено', uk: 'Вітряно', ja: '風', ko: '바람 불어요', zh: '刮风', ar: 'عاصف' },
  'we-hot':    { ro: 'Cald', es: 'Calor', fr: 'Chaud', pt: 'Quente', de: 'Heiß', ru: 'Жарко', uk: 'Спекотно', ja: '暑い', ko: '더워요', zh: '热', ar: 'حار' },
  'we-cold':   { ro: 'Frig', es: 'Frío', fr: 'Froid', pt: 'Frio', de: 'Kalt', ru: 'Холодно', uk: 'Холодно', ja: '寒い', ko: '추워요', zh: '冷', ar: 'بارد' },
  'we-storm':  { ro: 'Furtună', es: 'Tormenta', fr: 'Tempête', pt: 'Tempestade', de: 'Sturm', ru: 'Гроза', uk: 'Буря', ja: '嵐', ko: '폭풍', zh: '暴风雨', ar: 'عاصفة' },

  // Toys & Fun
  'tf-ball':     { ro: 'Minge', es: 'Pelota', fr: 'Ballon', pt: 'Bola', de: 'Ball', ru: 'Мяч', uk: 'М\'яч', ja: 'ボール', ko: '공', zh: '球', ar: 'كرة' },
  'tf-blocks':   { ro: 'Cuburi', es: 'Bloques', fr: 'Blocs', pt: 'Blocos', de: 'Bausteine', ru: 'Кубики', uk: 'Кубики', ja: 'ブロック', ko: '블록', zh: '积木', ar: 'مكعبات' },
  'tf-doll':     { ro: 'Păpușă', es: 'Muñeca', fr: 'Poupée', pt: 'Boneca', de: 'Puppe', ru: 'Кукла', uk: 'Лялька', ja: '人形', ko: '인형', zh: '娃娃', ar: 'دمية' },
  'tf-puzzle':   { ro: 'Puzzle', es: 'Rompecabezas', fr: 'Puzzle', pt: 'Quebra-cabeça', de: 'Puzzle', ru: 'Пазл', uk: 'Пазл', ja: 'パズル', ko: '퍼즐', zh: '拼图', ar: 'لغز' },
  'tf-game':     { ro: 'Joc', es: 'Juego', fr: 'Jeu', pt: 'Jogo', de: 'Spiel', ru: 'Игра', uk: 'Гра', ja: 'ゲーム', ko: '게임', zh: '游戏', ar: 'لعبة' },
  'tf-movie':    { ro: 'Film', es: 'Película', fr: 'Film', pt: 'Filme', de: 'Film', ru: 'Фильм', uk: 'Фільм', ja: '映画', ko: '영화', zh: '电影', ar: 'فيلم' },
  'tf-music':    { ro: 'Muzică', es: 'Música', fr: 'Musique', pt: 'Música', de: 'Musik', ru: 'Музыка', uk: 'Музика', ja: '音楽', ko: '음악', zh: '音乐', ar: 'موسيقى' },
  'tf-bubbles':  { ro: 'Baloane', es: 'Burbujas', fr: 'Bulles', pt: 'Bolhas', de: 'Seifenblasen', ru: 'Пузыри', uk: 'Бульбашки', ja: 'シャボン玉', ko: '비누방울', zh: '泡泡', ar: 'فقاعات' },
  'tf-swing':    { ro: 'Leagăn', es: 'Columpio', fr: 'Balançoire', pt: 'Balanço', de: 'Schaukel', ru: 'Качели', uk: 'Гойдалка', ja: 'ブランコ', ko: '그네', zh: '秋千', ar: 'أرجوحة' },
  'tf-slide':    { ro: 'Tobogan', es: 'Tobogán', fr: 'Toboggan', pt: 'Escorregador', de: 'Rutsche', ru: 'Горка', uk: 'Гірка', ja: 'すべり台', ko: '미끄럼틀', zh: '滑梯', ar: 'زحليقة' },
  'tf-coloring': { ro: 'Colorat', es: 'Colorear', fr: 'Coloriage', pt: 'Colorir', de: 'Malen', ru: 'Раскраска', uk: 'Розмальовка', ja: 'お絵かき', ko: '색칠', zh: '涂色', ar: 'تلوين' },
  'tf-tablet':   { ro: 'Tabletă', es: 'Tableta', fr: 'Tablette', pt: 'Tablet', de: 'Tablet', ru: 'Планшет', uk: 'Планшет', ja: 'タブレット', ko: '태블릿', zh: '平板', ar: 'جهاز لوحي' },

  // Ordering sequences — Chipotle
  'chip-o1': { ro: 'Pot să primesc un...', es: '¿Puedo pedir un...', fr: 'Je voudrais un...', pt: 'Posso pedir um...', de: 'Kann ich ein...', ru: 'Можно мне...', uk: 'Можна мені...', ja: '注文したいのですが', ko: '주문하고 싶어요', zh: '我想要一个...', ar: 'هل يمكنني...' },
  'chip-o2': { ro: 'Aș vrea să comand...', es: 'Me gustaría pedir...', fr: 'Je voudrais commander...', pt: 'Eu gostaria de pedir...', de: 'Ich möchte bestellen...', ru: 'Я хотел бы заказать...', uk: 'Я хотів би замовити...', ja: '注文をお願いします', ko: '주문할게요', zh: '我想点...', ar: 'أود أن أطلب...' },
  'chip-o3': { ro: 'Aici vă rog', es: 'Para aquí por favor', fr: 'Sur place svp', pt: 'Para comer aqui', de: 'Zum hier essen', ru: 'Здесь пожалуйста', uk: 'Тут будь ласка', ja: '店内で', ko: '여기서 먹을게요', zh: '在这里吃', ar: 'هنا من فضلك' },
  'chip-o4': { ro: 'La pachet vă rog', es: 'Para llevar por favor', fr: 'À emporter svp', pt: 'Para levar', de: 'Zum mitnehmen', ru: 'С собой пожалуйста', uk: 'З собою будь ласка', ja: '持ち帰りで', ko: '포장해주세요', zh: '打包', ar: 'للأخذ من فضلك' },
  'chip-b1': { ro: 'Burrito', es: 'Burrito', fr: 'Burrito', pt: 'Burrito', de: 'Burrito', ru: 'Буррито', uk: 'Буріто', ja: 'ブリトー', ko: '부리또', zh: '卷饼', ar: 'بوريتو' },
  'chip-b2': { ro: 'Bol', es: 'Tazón', fr: 'Bol', pt: 'Tigela', de: 'Schüssel', ru: 'Боул', uk: 'Боул', ja: 'ボウル', ko: '보울', zh: '碗', ar: 'وعاء' },
  'chip-b3': { ro: 'Tacos', es: 'Tacos', fr: 'Tacos', pt: 'Tacos', de: 'Tacos', ru: 'Тако', uk: 'Тако', ja: 'タコス', ko: '타코', zh: '玉米饼', ar: 'تاكو' },
  'chip-b4': { ro: 'Quesadilla', es: 'Quesadilla', fr: 'Quesadilla', pt: 'Quesadilla', de: 'Quesadilla', ru: 'Кесадилья', uk: 'Кесаділья', ja: 'ケサディーヤ', ko: '케사디야', zh: '芝士玉米饼', ar: 'كيساديا' },
  'chip-b5': { ro: 'Salată', es: 'Ensalada', fr: 'Salade', pt: 'Salada', de: 'Salat', ru: 'Салат', uk: 'Салат', ja: 'サラダ', ko: '샐러드', zh: '沙拉', ar: 'سلطة' },
  'chip-p1': { ro: 'Pui', es: 'Pollo', fr: 'Poulet', pt: 'Frango', de: 'Hähnchen', ru: 'Курица', uk: 'Курка', ja: 'チキン', ko: '치킨', zh: '鸡肉', ar: 'دجاج' },
  'chip-p2': { ro: 'Vită', es: 'Bistec', fr: 'Bœuf', pt: 'Bife', de: 'Steak', ru: 'Стейк', uk: 'Стейк', ja: 'ステーキ', ko: '스테이크', zh: '牛排', ar: 'ستيك' },
  'chip-p3': { ro: 'Barbacoa', es: 'Barbacoa', fr: 'Barbacoa', pt: 'Barbacoa', de: 'Barbacoa', ru: 'Барбакоа', uk: 'Барбакоа', ja: 'バルバコア', ko: '바르바코아', zh: '烤牛肉', ar: 'باربكوا' },
  'chip-p4': { ro: 'Carnitas', es: 'Carnitas', fr: 'Carnitas', pt: 'Carnitas', de: 'Carnitas', ru: 'Карнитас', uk: 'Карнітас', ja: 'カルニタス', ko: '카르니타스', zh: '烤猪肉', ar: 'كارنيتاس' },
  'chip-p5': { ro: 'Sofritas', es: 'Sofritas', fr: 'Sofritas', pt: 'Sofritas', de: 'Sofritas', ru: 'Софритас', uk: 'Софрітас', ja: 'ソフリタス', ko: '소프리타스', zh: '豆腐', ar: 'سوفريتاس' },
  'chip-p6': { ro: 'Legume', es: 'Vegetales', fr: 'Légumes', pt: 'Vegetais', de: 'Gemüse', ru: 'Овощи', uk: 'Овочі', ja: '野菜', ko: '채소', zh: '蔬菜', ar: 'خضار' },
  'chip-t1': { ro: 'Orez', es: 'Arroz', fr: 'Riz', pt: 'Arroz', de: 'Reis', ru: 'Рис', uk: 'Рис', ja: 'ご飯', ko: '밥', zh: '米饭', ar: 'أرز' },
  'chip-t2': { ro: 'Fasole', es: 'Frijoles', fr: 'Haricots', pt: 'Feijão', de: 'Bohnen', ru: 'Фасоль', uk: 'Квасоля', ja: '豆', ko: '콩', zh: '豆', ar: 'فاصوليا' },
  'chip-t3': { ro: 'Brânză', es: 'Queso', fr: 'Fromage', pt: 'Queijo', de: 'Käse', ru: 'Сыр', uk: 'Сир', ja: 'チーズ', ko: '치즈', zh: '奶酪', ar: 'جبنة' },
  'chip-t4': { ro: 'Smântână', es: 'Crema', fr: 'Crème fraîche', pt: 'Creme azedo', de: 'Sauerrahm', ru: 'Сметана', uk: 'Сметана', ja: 'サワークリーム', ko: '사워크림', zh: '酸奶油', ar: 'كريمة حامضة' },
  'chip-t5': { ro: 'Guacamole', es: 'Guacamole', fr: 'Guacamole', pt: 'Guacamole', de: 'Guacamole', ru: 'Гуакамоле', uk: 'Гуакамоле', ja: 'ワカモレ', ko: '과카몰리', zh: '牛油果酱', ar: 'غواكامولي' },
  'chip-t6': { ro: 'Salsa', es: 'Salsa', fr: 'Salsa', pt: 'Salsa', de: 'Salsa', ru: 'Сальса', uk: 'Сальса', ja: 'サルサ', ko: '살사', zh: '莎莎酱', ar: 'صلصة' },
  'chip-t7': { ro: 'Salată verde', es: 'Lechuga', fr: 'Laitue', pt: 'Alface', de: 'Salat', ru: 'Салат', uk: 'Салат', ja: 'レタス', ko: '상추', zh: '生菜', ar: 'خس' },
  'chip-t8': { ro: 'Porumb', es: 'Maíz', fr: 'Maïs', pt: 'Milho', de: 'Mais', ru: 'Кукуруза', uk: 'Кукурудза', ja: 'コーン', ko: '옥수수', zh: '玉米', ar: 'ذرة' },
  'chip-f1': { ro: 'Asta e tot', es: 'Eso es todo', fr: "C'est tout", pt: 'É tudo', de: 'Das ist alles', ru: 'Это всё', uk: 'Це все', ja: 'それで全部です', ko: '그게 다예요', zh: '就这些', ar: 'هذا كل شيء' },
  'chip-f2': { ro: 'Și o băutură vă rog', es: 'Y una bebida por favor', fr: 'Et une boisson svp', pt: 'E uma bebida por favor', de: 'Und ein Getränk bitte', ru: 'И напиток пожалуйста', uk: 'І напій будь ласка', ja: '飲み物もお願いします', ko: '음료도 주세요', zh: '再来杯饮料', ar: 'ومشروب من فضلك' },
  'chip-f3': { ro: 'Și chips-uri vă rog', es: 'Y papas por favor', fr: 'Et des chips svp', pt: 'E batatas por favor', de: 'Und Chips bitte', ru: 'И чипсы пожалуйста', uk: 'І чіпси будь ласка', ja: 'チップスもお願いします', ko: '칩도 주세요', zh: '再来份薯片', ar: 'ورقائق من فضلك' },
  'chip-f4': { ro: 'Mulțumesc', es: 'Gracias', fr: 'Merci', pt: 'Obrigado', de: 'Danke', ru: 'Спасибо', uk: 'Дякую', ja: 'ありがとう', ko: '감사합니다', zh: '谢谢', ar: 'شكرا' },

  // Ordering sequences — General Restaurant
  'gen-o1': { ro: 'Pot vedea meniul?', es: '¿Puedo ver el menú?', fr: 'Je peux voir le menu?', pt: 'Posso ver o cardápio?', de: 'Kann ich die Karte sehen?', ru: 'Можно посмотреть меню?', uk: 'Можна подивитися меню?', ja: 'メニューを見せてください', ko: '메뉴 볼 수 있나요?', zh: '可以看菜单吗?', ar: 'هل يمكنني رؤية القائمة؟' },
  'gen-o2': { ro: 'Aș vrea să comand', es: 'Me gustaría pedir', fr: 'Je voudrais commander', pt: 'Eu gostaria de pedir', de: 'Ich möchte bestellen', ru: 'Я хотел бы заказать', uk: 'Я хотів би замовити', ja: '注文したいです', ko: '주문하고 싶어요', zh: '我想点菜', ar: 'أريد أن أطلب' },
  'gen-o3': { ro: 'Masă pentru doi vă rog', es: 'Mesa para dos por favor', fr: 'Table pour deux svp', pt: 'Mesa para dois por favor', de: 'Tisch für zwei bitte', ru: 'Столик на двоих пожалуйста', uk: 'Столик на двох будь ласка', ja: '二人席お願いします', ko: '두 명 자리 주세요', zh: '两人桌谢谢', ar: 'طاولة لشخصين من فضلك' },
  'gen-r1': { ro: 'O să iau...', es: 'Voy a tomar...', fr: 'Je vais prendre...', pt: 'Vou querer...', de: 'Ich nehme...', ru: 'Я возьму...', uk: 'Я візьму...', ja: '...をお願いします', ko: '...으로 할게요', zh: '我要...', ar: 'سأطلب...' },
  'gen-r2': { ro: 'Pot să primesc...', es: '¿Puedo pedir...', fr: 'Je peux avoir...', pt: 'Posso pedir...', de: 'Kann ich... haben', ru: 'Можно мне...', uk: 'Можна мені...', ja: '...をもらえますか', ko: '...주세요', zh: '可以给我...', ar: 'هل يمكنني الحصول على...' },
  'gen-r3': { ro: 'Ce recomandați?', es: '¿Qué recomienda?', fr: 'Que recommandez-vous?', pt: 'O que você recomenda?', de: 'Was empfehlen Sie?', ru: 'Что вы порекомендуете?', uk: 'Що порадите?', ja: 'おすすめは?', ko: '추천 메뉴는?', zh: '有什么推荐?', ar: 'ماذا توصي؟' },
  'gen-m1': { ro: 'Fără ceapă vă rog', es: 'Sin cebolla por favor', fr: 'Sans oignon svp', pt: 'Sem cebola por favor', de: 'Ohne Zwiebeln bitte', ru: 'Без лука пожалуйста', uk: 'Без цибулі будь ласка', ja: '玉ねぎ抜きで', ko: '양파 빼주세요', zh: '不要洋葱', ar: 'بدون بصل من فضلك' },
  'gen-m2': { ro: 'Separat', es: 'Aparte', fr: 'À côté', pt: 'Separado', de: 'Extra bitte', ru: 'Отдельно', uk: 'Окремо', ja: '別で', ko: '따로 주세요', zh: '放旁边', ar: 'على الجانب' },
  'gen-m3': { ro: 'Mai mult vă rog', es: 'Extra por favor', fr: 'Extra svp', pt: 'Extra por favor', de: 'Extra bitte', ru: 'Побольше пожалуйста', uk: 'Побільше будь ласка', ja: '多めで', ko: '더 많이 주세요', zh: '多一点', ar: 'إضافي من فضلك' },
  'gen-m4': { ro: 'Este fără gluten?', es: '¿Eso es sin gluten?', fr: 'Est-ce sans gluten?', pt: 'É sem glúten?', de: 'Ist das glutenfrei?', ru: 'Это без глютена?', uk: 'Це без глютену?', ja: 'グルテンフリーですか?', ko: '글루텐 프리인가요?', zh: '这是无麸质的吗?', ar: 'هل هذا خالٍ من الجلوتين؟' },
  'gen-f1': { ro: 'Asta e tot, mulțumesc', es: 'Eso es todo, gracias', fr: "C'est tout, merci", pt: 'É tudo, obrigado', de: 'Das ist alles, danke', ru: 'Это всё, спасибо', uk: 'Це все, дякую', ja: '以上です、ありがとう', ko: '그게 다예요, 감사합니다', zh: '就这些，谢谢', ar: 'هذا كل شيء، شكرا' },
  'gen-f2': { ro: 'Nota de plată vă rog', es: '¿Puede traer la cuenta?', fr: "L'addition svp", pt: 'A conta por favor', de: 'Die Rechnung bitte', ru: 'Счёт пожалуйста', uk: 'Рахунок будь ласка', ja: 'お会計お願いします', ko: '계산서 주세요', zh: '买单', ar: 'الحساب من فضلك' },
  'gen-f3': { ro: 'A fost delicios', es: 'Estuvo delicioso', fr: "C'était délicieux", pt: 'Estava delicioso', de: 'Es war köstlich', ru: 'Было очень вкусно', uk: 'Було дуже смачно', ja: 'おいしかったです', ko: '맛있었어요', zh: '很好吃', ar: 'كان لذيذا' },

  // Phase 1 expansion (auto-generated 2026-05-07)
  'cw-us': { ro: 'Pe noi' },
  'cw-them': { ro: 'Pe ei' },
  'cw-mine': { ro: 'Al meu' },
  'cw-yours': { ro: 'Al tău' },
  'cw-theirs': { ro: 'Al lor' },
  'cw-ours': { ro: 'Al nostru' },
  'cw-hers': { ro: 'Al ei' },
  'cw-myself': { ro: 'Eu însumi' },
  'cw-yourself': { ro: 'Tu însuți' },
  'cw-themselves': { ro: 'Ei înșiși' },
  'cw-ourselves': { ro: 'Noi înșine' },
  'cw-each-other': { ro: 'Unul pe altul' },
  'cw-anyone': { ro: 'Oricine' },
  'cw-someone': { ro: 'Cineva' },
  'cw-everyone': { ro: 'Toată lumea' },
  'cw-no-one': { ro: 'Nimeni' },
  'cw-nobody': { ro: 'Nimeni' },
  'cw-whose': { ro: 'Al cui' },
  'cw-wait': { es: 'Esperar' },
  'cw-stop': { es: 'Parar' },
  'cw-start': { es: 'Empezar' },
  'cw-finish': { es: 'Terminar' },
  'cw-begin': { es: 'Comenzar' },
  'cw-end': { es: 'Acabar' },
  'cw-stay': { es: 'Quedar' },
  'cw-leave': { es: 'Salir' },
  'cw-look': { es: 'Mirar' },
  'cw-watch': { es: 'Observar' },
  'cw-hear': { es: 'Oír' },
  'cw-listen': { es: 'Escuchar' },
  'cw-smell': { es: 'Oler' },
  'cw-taste': { es: 'Probar' },
  'cw-touch': { es: 'Tocar' },
  'cw-hold': { es: 'Sostener' },
  'cw-grab': { es: 'Agarrar' },
  'cw-push': { es: 'Empujar' },
  'cw-pull': { es: 'Tirar' },
  'cw-lift': { es: 'Levantar' },
  'cw-carry': { es: 'Llevar' },
  'cw-drop': { es: 'Soltar' },
  'cw-throw': { es: 'Lanzar' },
  'cw-catch': { es: 'Atrapar' },
  'cw-open': { es: 'Abrir' },
  'cw-close': { es: 'Cerrar' },
  'cw-turn': { es: 'Girar' },
  'cw-move': { es: 'Mover' },
  'cw-sit': { es: 'Sentar' },
  'cw-stand': { es: 'Pararse' },
  'cw-walk': { es: 'Caminar' },
  'cw-run': { es: 'Correr' },
  'cw-jump': { es: 'Saltar' },
  'cw-climb': { es: 'Trepar' },
  'cw-fall': { es: 'Caer' },
  'cw-rest': { es: 'Descansar' },
  'cw-sleep': { es: 'Dormir' },
  'cw-wake': { es: 'Despertar' },
  'cw-dream': { es: 'Soñar' },
  'cw-eat': { es: 'Comer' },
  'cw-drink': { es: 'Beber' },
  'cw-bite': { es: 'Morder' },
  'cw-chew': { es: 'Masticar' },
  'cw-swallow': { es: 'Tragar' },
  'cw-spit': { es: 'Escupir' },
  'cw-talk': { es: 'Hablar' },
  'cw-speak': { es: 'Hablar' },
  'cw-whisper': { es: 'Susurrar' },
  'cw-shout': { es: 'Gritar' },
  'cw-sing': { es: 'Cantar' },
  'cw-laugh': { es: 'Reír' },
  'cw-cry': { es: 'Llorar' },
  'cw-smile': { es: 'Sonreír' },
  'cw-read': { es: 'Leer' },
  'cw-write': { es: 'Escribir' },
  'cw-draw': { es: 'Dibujar' },
  'cw-paint': { es: 'Pintar' },
  'cw-color': { es: 'Colorear' },
  'cw-cut': { es: 'Cortar' },
  'cw-glue': { es: 'Pegar' },
  'cw-build': { es: 'Construir' },
  'cw-break': { es: 'Romper' },
  'cw-fix': { es: 'Arreglar' },
  'cw-clean': { es: 'Limpiar' },
  'cw-wash': { es: 'Lavar' },
  'cw-find': { es: 'Encontrar' },
  'cw-look-for': { es: 'Buscar' },
  'cw-lose': { es: 'Perder' },
  'cw-save': { es: 'Guardar' },
  'cw-keep': { es: 'Guardar' },
  'cw-buy': { es: 'Comprar' },
  'cw-sell': { es: 'Vender' },
  'cw-pay': { es: 'Pagar' },
  'cw-trade': { es: 'Cambiar' },
  'cw-send': { es: 'Enviar' },
  'cw-bring': { es: 'Traer' },
  'cw-take': { es: 'Tomar' },
  'cw-give': { es: 'Dar' },
  'cw-share': { es: 'Compartir' },
  'cw-ask': { es: 'Preguntar' },
  'cw-answer': { es: 'Responder' },
  'cw-show': { es: 'Mostrar' },
  'cw-hide': { es: 'Esconder' },
  'cw-learn': { es: 'Aprender' },
  'cw-teach': { es: 'Enseñar' },
  'cw-study': { es: 'Estudiar' },
  'cw-practice': { es: 'Practicar' },
  'cw-work': { es: 'Trabajar' },
  'cw-play': { es: 'Jugar' },
  'cw-win': { es: 'Ganar' },
  'cw-try-again': { es: 'Intentar otra vez' },
  'cw-hug': { es: 'Abrazar' },
  'cw-kiss': { es: 'Besar' },
  'cw-pet': { es: 'Acariciar' },
  'cw-tickle': { es: 'Hacer cosquillas' },
  'cw-wait-for-me': { es: 'Espérame' },
  'cw-help-me': { es: 'Ayúdame' },
  'cw-show-me': { es: 'Muéstrame' },
  'cw-tell-me': { es: 'Dime' },
  'cw-stop-that': { es: 'Para eso' },
  'cw-don-t-do-that': { es: 'No hagas eso' },
  'cw-i-want-to': { es: 'Quiero' },
  'cw-i-do-not-want': { es: 'No quiero' },
  'cw-let-me-try': { es: 'Déjame intentar' },
  'cw-let-me-see': { es: 'Déjame ver' },
  'cw-little': {},  // pending Phase 2 multilingual fill
  'cw-lots': {},  // pending Phase 2 multilingual fill
  'cw-many': {},  // pending Phase 2 multilingual fill
  'cw-few': {},  // pending Phase 2 multilingual fill
  'cw-every': {},  // pending Phase 2 multilingual fill
  'cw-any': {},  // pending Phase 2 multilingual fill
  'cw-only': {},  // pending Phase 2 multilingual fill
  'cw-just': {},  // pending Phase 2 multilingual fill
  'cw-full': {},  // pending Phase 2 multilingual fill
  'cw-empty': {},  // pending Phase 2 multilingual fill
  'cw-open-2': {},  // pending Phase 2 multilingual fill
  'cw-closed': {},  // pending Phase 2 multilingual fill
  'cw-easy': {},  // pending Phase 2 multilingual fill
  'cw-hard': {},  // pending Phase 2 multilingual fill
  'cw-soft': {},  // pending Phase 2 multilingual fill
  'cw-loud': {},  // pending Phase 2 multilingual fill
  'cw-quiet': {},  // pending Phase 2 multilingual fill
  'cw-bright': {},  // pending Phase 2 multilingual fill
  'cw-dark': {},  // pending Phase 2 multilingual fill
  'cw-heavy': {},  // pending Phase 2 multilingual fill
  'cw-light': {},  // pending Phase 2 multilingual fill
  'cw-above': {},  // pending Phase 2 multilingual fill
  'cw-below': {},  // pending Phase 2 multilingual fill
  'cw-beside': {},  // pending Phase 2 multilingual fill
  'cw-between': {},  // pending Phase 2 multilingual fill
  'cw-near': {},  // pending Phase 2 multilingual fill
  'cw-far': {},  // pending Phase 2 multilingual fill
  'cw-around': {},  // pending Phase 2 multilingual fill
  'cw-through': {},  // pending Phase 2 multilingual fill
  'cw-over': {},  // pending Phase 2 multilingual fill
  'cw-under': {},  // pending Phase 2 multilingual fill
  'cw-across': {},  // pending Phase 2 multilingual fill
  'cw-behind': {},  // pending Phase 2 multilingual fill
  'cw-ahead': {},  // pending Phase 2 multilingual fill
  'cw-always': {},  // pending Phase 2 multilingual fill
  'cw-never': {},  // pending Phase 2 multilingual fill
  'cw-often': {},  // pending Phase 2 multilingual fill
  'cw-sometimes': {},  // pending Phase 2 multilingual fill
  'cw-maybe': {},  // pending Phase 2 multilingual fill
  'cw-almost': {},  // pending Phase 2 multilingual fill
  'cw-already': {},  // pending Phase 2 multilingual fill
  'cw-still': {},  // pending Phase 2 multilingual fill
  'cw-yet': {},  // pending Phase 2 multilingual fill
  'cw-right-now': {},  // pending Phase 2 multilingual fill
  'cw-right-here': {},  // pending Phase 2 multilingual fill
  'cw-way-too-much': {},  // pending Phase 2 multilingual fill
  'cw-not-enough': {},  // pending Phase 2 multilingual fill
  'cw-by': {},  // pending Phase 2 multilingual fill
  'cw-from': {},  // pending Phase 2 multilingual fill
  'cw-since': {},  // pending Phase 2 multilingual fill
  'cw-until': {},  // pending Phase 2 multilingual fill
  'cw-into': {},  // pending Phase 2 multilingual fill
  'cw-onto': {},  // pending Phase 2 multilingual fill
  'cw-off-of': {},  // pending Phase 2 multilingual fill
  'cw-away': {},  // pending Phase 2 multilingual fill
  'cw-back': {},  // pending Phase 2 multilingual fill
  'cw-beside-2': {},  // pending Phase 2 multilingual fill
  'cw-past': {},  // pending Phase 2 multilingual fill
  'cw-among': {},  // pending Phase 2 multilingual fill
  'cw-during': {},  // pending Phase 2 multilingual fill
  'cw-while': {},  // pending Phase 2 multilingual fill
  'cw-whenever': {},  // pending Phase 2 multilingual fill
  'cw-wherever': {},  // pending Phase 2 multilingual fill
  'cw-both': {},  // pending Phase 2 multilingual fill
  'cw-either': {},  // pending Phase 2 multilingual fill
  'cw-neither': {},  // pending Phase 2 multilingual fill
  'cw-whether': {},  // pending Phase 2 multilingual fill
  'cw-although': {},  // pending Phase 2 multilingual fill
  'cw-though': {},  // pending Phase 2 multilingual fill
  'cw-unless': {},  // pending Phase 2 multilingual fill
  'cw-so': {},  // pending Phase 2 multilingual fill
  'cw-then': {},  // pending Phase 2 multilingual fill
  'cw-also': {},  // pending Phase 2 multilingual fill
  'cw-plus': {},  // pending Phase 2 multilingual fill
  'cw-like-2': {},  // pending Phase 2 multilingual fill
  'cw-as': {},  // pending Phase 2 multilingual fill
  'cw-such-as': {},  // pending Phase 2 multilingual fill
  'cw-versus': {},  // pending Phase 2 multilingual fill
  'cw-since-then': {},  // pending Phase 2 multilingual fill
  'cw-until-now': {},  // pending Phase 2 multilingual fill
  'cw-right-after': {},  // pending Phase 2 multilingual fill
  'cw-just-before': {},  // pending Phase 2 multilingual fill
  'cw-up-to': {},  // pending Phase 2 multilingual fill
  'cw-down-to': {},  // pending Phase 2 multilingual fill
  'cw-next-to': {},  // pending Phase 2 multilingual fill
  'cw-out-of': {},  // pending Phase 2 multilingual fill
  'cw-a-few': {},  // pending Phase 2 multilingual fill
  'cw-a-lot': {},  // pending Phase 2 multilingual fill
  'cw-a-little': {},  // pending Phase 2 multilingual fill
  'help-i-am-cold': { ru: 'Мне холодно' },
  'help-i-am-hot': { ru: 'Мне жарко' },
  'help-i-am-sleepy': { ru: 'Я хочу спать' },
  'help-i-am-scared': { ru: 'Мне страшно' },
  'help-i-am-sick': { ru: 'Я болею' },
  'help-i-am-okay': { ru: 'Я в порядке' },
  'help-i-am-not-okay': { ru: 'Мне нехорошо' },
  'help-i-am-ready': { ru: 'Я готов' },
  'help-i-am-not-ready': { ru: 'Я не готов' },
  'help-too-loud': { ru: 'Слишком громко' },
  'help-too-bright': { ru: 'Слишком ярко' },
  'help-too-fast': { ru: 'Слишком быстро' },
  'help-too-slow': { ru: 'Слишком медленно' },
  'help-i-need-quiet': { ru: 'Мне нужно тише' },
  'help-i-need-a-break': { ru: 'Мне нужен перерыв' },
  'help-i-need-water': { ru: 'Мне нужна вода' },
  'help-i-need-air': { ru: 'Мне нужен воздух' },
  'help-i-need-my-mom': { ru: 'Мне нужна мама' },
  'help-i-need-my-dad': { ru: 'Мне нужен папа' },
  'help-i-need-my-teacher': { ru: 'Мне нужен учитель' },
  'help-i-need-a-hug': { ru: 'Мне нужно обнять' },
  'help-i-need-space': { ru: 'Мне нужно пространство' },
  'help-i-need-time': { ru: 'Мне нужно время' },
  'help-hold-my-hand': { ru: 'Возьми меня за руку' },
  'help-watch-me': { ru: 'Смотри на меня' },
  'help-listen-to-me': { ru: 'Послушай меня' },
  'help-look-at-this': { ru: 'Посмотри на это' },
  'help-help-me-please': { ru: 'Помоги мне, пожалуйста' },
  'help-help-with-this': { ru: 'Помоги с этим' },
  'help-wait-for-me': { ru: 'Подожди меня' },
  'help-slow-down-please': { ru: 'Медленнее, пожалуйста' },
  'help-speak-more-slowly': { ru: 'Говори медленнее' },
  'help-one-at-a-time': { ru: 'По одному' },
  'help-i-am-overwhelmed': { ru: 'Я устал от всего' },
  'help-i-am-confused': { ru: 'Я запутался' },
  'help-i-do-not-understand': { ru: 'Я не понимаю' },
  'help-please-be-patient': { ru: 'Пожалуйста, будь терпелив' },
  'help-give-me-a-minute': { ru: 'Дай мне минуту' },
  'help-try-again': { ru: 'Попробуй ещё раз' },
  'help-calm-down': { ru: 'Успокойся' },
  'help-let-me-think': { ru: 'Дай мне подумать' },
  'help-show-me-how': { ru: 'Покажи мне как' },
  'help-i-do-not-feel-good': { ru: 'Мне нехорошо' },
  'help-my-head-hurts': { ru: 'У меня болит голова' },
  'help-my-tummy-hurts': { ru: 'У меня болит живот' },
  'help-my-ears-hurt': { ru: 'У меня болят уши' },
  'help-my-eyes-hurt': { ru: 'У меня болят глаза' },
  'help-i-feel-dizzy': { ru: 'У меня кружится голова' },
  'help-get-help': { ru: 'Позови на помощь' },
  'help-call-my-mom': { ru: 'Позвони маме' },
  'help-call-my-dad': { ru: 'Позвони папе' },
  'help-call-the-nurse': { ru: 'Позови медсестру' },
  'help-where-is-my-aac': { ru: 'Где мой AAC' },
  'help-my-battery-is-low': { ru: 'У меня разряжается батарея' },
  'help-i-dropped-my-tablet': { ru: 'Я уронил планшет' },
  'qt-hi': {},  // pending Phase 2 multilingual fill
  'qt-hey': {},  // pending Phase 2 multilingual fill
  'qt-bye': {},  // pending Phase 2 multilingual fill
  'qt-bye-bye': {},  // pending Phase 2 multilingual fill
  'qt-see-you': {},  // pending Phase 2 multilingual fill
  'qt-see-you-soon': {},  // pending Phase 2 multilingual fill
  'qt-see-you-tomorrow': {},  // pending Phase 2 multilingual fill
  'qt-take-care': {},  // pending Phase 2 multilingual fill
  'qt-have-fun': {},  // pending Phase 2 multilingual fill
  'qt-good-morning': {},  // pending Phase 2 multilingual fill
  'qt-good-afternoon': {},  // pending Phase 2 multilingual fill
  'qt-good-evening': {},  // pending Phase 2 multilingual fill
  'qt-good-night': {},  // pending Phase 2 multilingual fill
  'qt-good-job': {},  // pending Phase 2 multilingual fill
  'qt-well-done': {},  // pending Phase 2 multilingual fill
  'qt-way-to-go': {},  // pending Phase 2 multilingual fill
  'qt-awesome': {},  // pending Phase 2 multilingual fill
  'qt-cool': {},  // pending Phase 2 multilingual fill
  'qt-nice': {},  // pending Phase 2 multilingual fill
  'qt-great': {},  // pending Phase 2 multilingual fill
  'qt-wonderful': {},  // pending Phase 2 multilingual fill
  'qt-amazing': {},  // pending Phase 2 multilingual fill
  'qt-perfect': {},  // pending Phase 2 multilingual fill
  'qt-yay': {},  // pending Phase 2 multilingual fill
  'qt-okay': {},  // pending Phase 2 multilingual fill
  'qt-alright': {},  // pending Phase 2 multilingual fill
  'qt-sure': {},  // pending Phase 2 multilingual fill
  'qt-of-course': {},  // pending Phase 2 multilingual fill
  'qt-definitely': {},  // pending Phase 2 multilingual fill
  'qt-maybe': {},  // pending Phase 2 multilingual fill
  'qt-i-think-so': {},  // pending Phase 2 multilingual fill
  'qt-i-am-not-sure': {},  // pending Phase 2 multilingual fill
  'qt-it-is-fine': {},  // pending Phase 2 multilingual fill
  'qt-no-problem': {},  // pending Phase 2 multilingual fill
  'qt-no-worries': {},  // pending Phase 2 multilingual fill
  'qt-never-mind': {},  // pending Phase 2 multilingual fill
  'qt-my-bad': {},  // pending Phase 2 multilingual fill
  'qt-oops': {},  // pending Phase 2 multilingual fill
  'qt-bless-you': {},  // pending Phase 2 multilingual fill
  'qt-happy-birthday': {},  // pending Phase 2 multilingual fill
  'qt-happy-holidays': {},  // pending Phase 2 multilingual fill
  'qt-merry-christmas': {},  // pending Phase 2 multilingual fill
  'qt-happy-new-year': {},  // pending Phase 2 multilingual fill
  'qt-eid-mubarak': {},  // pending Phase 2 multilingual fill
  'qt-happy-hanukkah': {},  // pending Phase 2 multilingual fill
  'qt-congratulations': {},  // pending Phase 2 multilingual fill
  'qt-i-am-proud-of-you': {},  // pending Phase 2 multilingual fill
  'qt-you-did-it': {},  // pending Phase 2 multilingual fill
  'qt-how-was-your-day': {},  // pending Phase 2 multilingual fill
  'qt-i-had-a-good-day': {},  // pending Phase 2 multilingual fill
  'qt-i-had-a-bad-day': {},  // pending Phase 2 multilingual fill
  'qt-tell-me-about-your-day': {},  // pending Phase 2 multilingual fill
  'qt-i-missed-you': {},  // pending Phase 2 multilingual fill
  'qt-i-am-here': {},  // pending Phase 2 multilingual fill
  'qt-i-love-you-too': {},  // pending Phase 2 multilingual fill
  'qt-you-are-my-friend': {},  // pending Phase 2 multilingual fill
  'qt-best-friends': {},  // pending Phase 2 multilingual fill
  'fe-calm': { de: 'Ruhig' },
  'fe-peaceful': { de: 'Friedlich' },
  'fe-relaxed': { de: 'Entspannt' },
  'fe-content': { de: 'Zufrieden' },
  'fe-joyful': { de: 'Fröhlich' },
  'fe-glad': { de: 'Froh' },
  'fe-cheerful': { de: 'Heiter' },
  'fe-hopeful': { de: 'Hoffnungsvoll' },
  'fe-grateful': { de: 'Dankbar' },
  'fe-thankful': { de: 'Dankbar' },
  'fe-loved': { de: 'Geliebt' },
  'fe-safe': { de: 'Sicher' },
  'fe-comfortable': { de: 'Bequem' },
  'fe-warm-inside': { de: 'Warm im Herzen' },
  'fe-tired': { de: 'Müde' },
  'fe-sleepy': { de: 'Schläfrig' },
  'fe-hungry': { de: 'Hungrig' },
  'fe-full': { de: 'Satt' },
  'fe-thirsty': { de: 'Durstig' },
  'fe-sick': { de: 'Krank' },
  'fe-lonely': { de: 'Einsam' },
  'fe-embarrassed': { de: 'Verlegen' },
  'fe-shy': { de: 'Schüchtern' },
  'fe-ashamed': { de: 'Beschämt' },
  'fe-guilty': { de: 'Schuldig' },
  'fe-jealous': { de: 'Eifersüchtig' },
  'fe-disappointed': { de: 'Enttäuscht' },
  'fe-annoyed': { de: 'Genervt' },
  'fe-anxious': { de: 'Ängstlich' },
  'fe-worried': { de: 'Besorgt' },
  'fe-stressed': { de: 'Gestresst' },
  'fe-panicked': { de: 'Panisch' },
  'fe-terrified': { de: 'Verängstigt' },
  'fe-brave': { de: 'Mutig' },
  'fe-strong': { de: 'Stark' },
  'fe-weak': { de: 'Schwach' },
  'fe-dizzy': { de: 'Schwindelig' },
  'fe-itchy': { de: 'Juckend' },
  'fe-ticklish': { de: 'Kitzlig' },
  'fe-numb': { de: 'Taub' },
  'fe-cold-inside': { de: 'Kalt innen' },
  'fe-empty': { de: 'Leer' },
  'fe-heavy-heart': { de: 'Schweres Herz' },
  'fe-mixed-up': { de: 'Durcheinander' },
  'fe-confused-inside': { de: 'Innerlich verwirrt' },
  'fe-stuck': { de: 'Festgefahren' },
  'fe-missing-someone': { de: 'Jemanden vermissen' },
  'fe-homesick': { de: 'Heimweh' },
  'fe-overwhelmed': { de: 'Überwältigt' },
  'fe-done-with-this': { de: 'Damit fertig' },
  'fe-i-have-had-enough': { de: 'Ich habe genug' },
  'fe-i-feel-good': { de: 'Ich fühle mich gut' },
  'fe-i-feel-bad': { de: 'Ich fühle mich schlecht' },
  'fe-i-feel-okay': { de: 'Es geht mir okay' },
  'fe-i-feel-weird': { de: 'Ich fühle mich seltsam' },
  'qu-who-is-that': {},  // pending Phase 2 multilingual fill
  'qu-what-is-that': {},  // pending Phase 2 multilingual fill
  'qu-where-is-it': {},  // pending Phase 2 multilingual fill
  'qu-when-is-it': {},  // pending Phase 2 multilingual fill
  'qu-why-is-that': {},  // pending Phase 2 multilingual fill
  'qu-how-does-it-work': {},  // pending Phase 2 multilingual fill
  'qu-how-do-i': {},  // pending Phase 2 multilingual fill
  'qu-can-i-have-it': {},  // pending Phase 2 multilingual fill
  'qu-can-i-try': {},  // pending Phase 2 multilingual fill
  'qu-can-i-go': {},  // pending Phase 2 multilingual fill
  'qu-may-i-please': {},  // pending Phase 2 multilingual fill
  'qu-will-you-help': {},  // pending Phase 2 multilingual fill
  'qu-are-you-okay': {},  // pending Phase 2 multilingual fill
  'qu-are-we-there-yet': {},  // pending Phase 2 multilingual fill
  'qu-where-are-we-going': {},  // pending Phase 2 multilingual fill
  'qu-when-will-we-be-there': {},  // pending Phase 2 multilingual fill
  'qu-how-much-longer': {},  // pending Phase 2 multilingual fill
  'qu-what-time-is-it': {},  // pending Phase 2 multilingual fill
  'qu-what-day-is-it': {},  // pending Phase 2 multilingual fill
  'qu-is-it-ready-yet': {},  // pending Phase 2 multilingual fill
  'qu-can-we-go-now': {},  // pending Phase 2 multilingual fill
  'qu-can-we-do-this': {},  // pending Phase 2 multilingual fill
  'qu-did-you-see-that': {},  // pending Phase 2 multilingual fill
  'qu-did-i-do-good': {},  // pending Phase 2 multilingual fill
  'qu-what-happened': {},  // pending Phase 2 multilingual fill
  'qu-where-did-it-go': {},  // pending Phase 2 multilingual fill
  'qu-who-said-that': {},  // pending Phase 2 multilingual fill
  'qu-what-did-they-say': {},  // pending Phase 2 multilingual fill
  'qu-how-old-are-you': {},  // pending Phase 2 multilingual fill
  'qu-what-is-your-name': {},  // pending Phase 2 multilingual fill
  'qu-how-are-you-feeling': {},  // pending Phase 2 multilingual fill
  'qu-what-is-for-dinner': {},  // pending Phase 2 multilingual fill
  'qu-what-is-for-snack': {},  // pending Phase 2 multilingual fill
  'qu-is-it-bedtime': {},  // pending Phase 2 multilingual fill
  'qu-are-you-my-friend': {},  // pending Phase 2 multilingual fill
  'qu-will-you-play-with-me': {},  // pending Phase 2 multilingual fill
  'ac-wave': {},  // pending Phase 2 multilingual fill
  'ac-clap': {},  // pending Phase 2 multilingual fill
  'ac-point': {},  // pending Phase 2 multilingual fill
  'ac-nod': {},  // pending Phase 2 multilingual fill
  'ac-shake-head': {},  // pending Phase 2 multilingual fill
  'ac-whisper': {},  // pending Phase 2 multilingual fill
  'ac-shout': {},  // pending Phase 2 multilingual fill
  'ac-sing': {},  // pending Phase 2 multilingual fill
  'ac-hum': {},  // pending Phase 2 multilingual fill
  'ac-roll': {},  // pending Phase 2 multilingual fill
  'ac-slide': {},  // pending Phase 2 multilingual fill
  'ac-spin': {},  // pending Phase 2 multilingual fill
  'ac-hop': {},  // pending Phase 2 multilingual fill
  'ac-skip': {},  // pending Phase 2 multilingual fill
  'ac-crawl': {},  // pending Phase 2 multilingual fill
  'ac-tiptoe': {},  // pending Phase 2 multilingual fill
  'ac-tip-toe': {},  // pending Phase 2 multilingual fill
  'ac-march': {},  // pending Phase 2 multilingual fill
  'ac-climb-up': {},  // pending Phase 2 multilingual fill
  'ac-climb-down': {},  // pending Phase 2 multilingual fill
  'ac-push-it': {},  // pending Phase 2 multilingual fill
  'ac-pull-it': {},  // pending Phase 2 multilingual fill
  'ac-pick-it-up': {},  // pending Phase 2 multilingual fill
  'ac-set-it-down': {},  // pending Phase 2 multilingual fill
  'ac-pour': {},  // pending Phase 2 multilingual fill
  'ac-stir': {},  // pending Phase 2 multilingual fill
  'ac-mix': {},  // pending Phase 2 multilingual fill
  'ac-spread': {},  // pending Phase 2 multilingual fill
  'ac-fold': {},  // pending Phase 2 multilingual fill
  'ac-tie': {},  // pending Phase 2 multilingual fill
  'ac-untie': {},  // pending Phase 2 multilingual fill
  'ac-zip': {},  // pending Phase 2 multilingual fill
  'ac-unzip': {},  // pending Phase 2 multilingual fill
  'ac-snap': {},  // pending Phase 2 multilingual fill
  'ac-buckle': {},  // pending Phase 2 multilingual fill
  'ac-brush-teeth': {},  // pending Phase 2 multilingual fill
  'ac-brush-hair': {},  // pending Phase 2 multilingual fill
  'ac-comb': {},  // pending Phase 2 multilingual fill
  'ac-floss': {},  // pending Phase 2 multilingual fill
  'ac-get-dressed': {},  // pending Phase 2 multilingual fill
  'ac-get-undressed': {},  // pending Phase 2 multilingual fill
  'ac-put-on-shoes': {},  // pending Phase 2 multilingual fill
  'ac-take-off-shoes': {},  // pending Phase 2 multilingual fill
  'ac-wash-hands': {},  // pending Phase 2 multilingual fill
  'ac-take-a-bath': {},  // pending Phase 2 multilingual fill
  'ac-take-a-shower': {},  // pending Phase 2 multilingual fill
  'ac-sleep': {},  // pending Phase 2 multilingual fill
  'ac-take-a-nap': {},  // pending Phase 2 multilingual fill
  'ac-wake-up': {},  // pending Phase 2 multilingual fill
  'ac-wait-for': {},  // pending Phase 2 multilingual fill
  'ac-look-for': {},  // pending Phase 2 multilingual fill
  'ac-search': {},  // pending Phase 2 multilingual fill
  'ac-discover': {},  // pending Phase 2 multilingual fill
  'ac-hide': {},  // pending Phase 2 multilingual fill
  'ac-seek': {},  // pending Phase 2 multilingual fill
  'ac-tag': {},  // pending Phase 2 multilingual fill
  'ac-race': {},  // pending Phase 2 multilingual fill
  'ac-cuddle': {},  // pending Phase 2 multilingual fill
  'ac-snuggle': {},  // pending Phase 2 multilingual fill
  'ac-pat': {},  // pending Phase 2 multilingual fill
  'ac-tickle': {},  // pending Phase 2 multilingual fill
  'ac-sweep': {},  // pending Phase 2 multilingual fill
  'ac-mop': {},  // pending Phase 2 multilingual fill
  'ac-vacuum': {},  // pending Phase 2 multilingual fill
  'ac-dust': {},  // pending Phase 2 multilingual fill
  'ac-carry-it': {},  // pending Phase 2 multilingual fill
  'ac-drop-it': {},  // pending Phase 2 multilingual fill
  'ac-toss-it': {},  // pending Phase 2 multilingual fill
  'ac-roll-it': {},  // pending Phase 2 multilingual fill
  'dw-tall': {},  // pending Phase 2 multilingual fill
  'dw-short': {},  // pending Phase 2 multilingual fill
  'dw-long': {},  // pending Phase 2 multilingual fill
  'dw-wide': {},  // pending Phase 2 multilingual fill
  'dw-narrow': {},  // pending Phase 2 multilingual fill
  'dw-thick': {},  // pending Phase 2 multilingual fill
  'dw-thin': {},  // pending Phase 2 multilingual fill
  'dw-round': {},  // pending Phase 2 multilingual fill
  'dw-square': {},  // pending Phase 2 multilingual fill
  'dw-smooth': {},  // pending Phase 2 multilingual fill
  'dw-rough': {},  // pending Phase 2 multilingual fill
  'dw-sticky': {},  // pending Phase 2 multilingual fill
  'dw-wet': {},  // pending Phase 2 multilingual fill
  'dw-dry': {},  // pending Phase 2 multilingual fill
  'dw-clean': {},  // pending Phase 2 multilingual fill
  'dw-dirty': {},  // pending Phase 2 multilingual fill
  'dw-soft': {},  // pending Phase 2 multilingual fill
  'dw-hard': {},  // pending Phase 2 multilingual fill
  'dw-sweet': {},  // pending Phase 2 multilingual fill
  'dw-salty': {},  // pending Phase 2 multilingual fill
  'dw-sour': {},  // pending Phase 2 multilingual fill
  'dw-spicy': {},  // pending Phase 2 multilingual fill
  'dw-bitter': {},  // pending Phase 2 multilingual fill
  'dw-quiet': {},  // pending Phase 2 multilingual fill
  'dw-loud': {},  // pending Phase 2 multilingual fill
  'dw-bright': {},  // pending Phase 2 multilingual fill
  'dw-dark': {},  // pending Phase 2 multilingual fill
  'dw-shiny': {},  // pending Phase 2 multilingual fill
  'dw-heavy': {},  // pending Phase 2 multilingual fill
  'dw-light': {},  // pending Phase 2 multilingual fill
  'dw-empty': {},  // pending Phase 2 multilingual fill
  'dw-full': {},  // pending Phase 2 multilingual fill
  'dw-easy': {},  // pending Phase 2 multilingual fill
  'dw-tricky': {},  // pending Phase 2 multilingual fill
  'dw-simple': {},  // pending Phase 2 multilingual fill
  'dw-fun': {},  // pending Phase 2 multilingual fill
  'dw-boring': {},  // pending Phase 2 multilingual fill
  'dw-cool': {},  // pending Phase 2 multilingual fill
  'dw-awesome': {},  // pending Phase 2 multilingual fill
  'dw-scary': {},  // pending Phase 2 multilingual fill
  'dw-safe': {},  // pending Phase 2 multilingual fill
  'dw-dangerous': {},  // pending Phase 2 multilingual fill
  'dw-friendly': {},  // pending Phase 2 multilingual fill
  'dw-mean': {},  // pending Phase 2 multilingual fill
  'dw-nice': {},  // pending Phase 2 multilingual fill
  'dw-helpful': {},  // pending Phase 2 multilingual fill
  'dw-mine': {},  // pending Phase 2 multilingual fill
  'dw-special': {},  // pending Phase 2 multilingual fill
  'pp-aunt': {},  // pending Phase 2 multilingual fill
  'pp-uncle': {},  // pending Phase 2 multilingual fill
  'pp-cousin': {},  // pending Phase 2 multilingual fill
  'pp-stepmom': {},  // pending Phase 2 multilingual fill
  'pp-stepdad': {},  // pending Phase 2 multilingual fill
  'pp-bus-driver': {},  // pending Phase 2 multilingual fill
  'pp-coach': {},  // pending Phase 2 multilingual fill
  'pp-principal': {},  // pending Phase 2 multilingual fill
  'pp-counselor': {},  // pending Phase 2 multilingual fill
  'pp-nurse': {},  // pending Phase 2 multilingual fill
  'pp-dentist': {},  // pending Phase 2 multilingual fill
  'pp-bcba': {},  // pending Phase 2 multilingual fill
  'pp-rbt': {},  // pending Phase 2 multilingual fill
  'pp-babysitter': {},  // pending Phase 2 multilingual fill
  'pp-neighbor': {},  // pending Phase 2 multilingual fill
  'pp-helper': {},  // pending Phase 2 multilingual fill
  'pp-classmate': {},  // pending Phase 2 multilingual fill
  'pp-best-friend': {},  // pending Phase 2 multilingual fill
  'pp-new-friend': {},  // pending Phase 2 multilingual fill
  'pp-man': {},  // pending Phase 2 multilingual fill
  'pp-woman': {},  // pending Phase 2 multilingual fill
  'pp-kid': {},  // pending Phase 2 multilingual fill
  'pp-grown-up': {},  // pending Phase 2 multilingual fill
  'pp-stranger': {},  // pending Phase 2 multilingual fill
  'pp-police-officer': {},  // pending Phase 2 multilingual fill
  'pp-firefighter': {},  // pending Phase 2 multilingual fill
  'pp-paramedic': {},  // pending Phase 2 multilingual fill
  'pp-my-family': {},  // pending Phase 2 multilingual fill
  'pp-my-class': {},  // pending Phase 2 multilingual fill
  'pp-my-team': {},  // pending Phase 2 multilingual fill
  'fd-bread': {},  // pending Phase 2 multilingual fill
  'fd-toast': {},  // pending Phase 2 multilingual fill
  'fd-pancakes': {},  // pending Phase 2 multilingual fill
  'fd-waffles': {},  // pending Phase 2 multilingual fill
  'fd-eggs': {},  // pending Phase 2 multilingual fill
  'fd-bacon': {},  // pending Phase 2 multilingual fill
  'fd-yogurt': {},  // pending Phase 2 multilingual fill
  'fd-oatmeal': {},  // pending Phase 2 multilingual fill
  'fd-granola': {},  // pending Phase 2 multilingual fill
  'fd-smoothie': {},  // pending Phase 2 multilingual fill
  'fd-pasta': {},  // pending Phase 2 multilingual fill
  'fd-noodles': {},  // pending Phase 2 multilingual fill
  'fd-rice': {},  // pending Phase 2 multilingual fill
  'fd-soup': {},  // pending Phase 2 multilingual fill
  'fd-salad': {},  // pending Phase 2 multilingual fill
  'fd-wrap': {},  // pending Phase 2 multilingual fill
  'fd-hamburger': {},  // pending Phase 2 multilingual fill
  'fd-hot-dog': {},  // pending Phase 2 multilingual fill
  'fd-taco': {},  // pending Phase 2 multilingual fill
  'fd-burrito': {},  // pending Phase 2 multilingual fill
  'fd-quesadilla': {},  // pending Phase 2 multilingual fill
  'fd-sushi': {},  // pending Phase 2 multilingual fill
  'fd-dumplings': {},  // pending Phase 2 multilingual fill
  'fd-curry': {},  // pending Phase 2 multilingual fill
  'fd-stir-fry': {},  // pending Phase 2 multilingual fill
  'fd-carrots': {},  // pending Phase 2 multilingual fill
  'fd-broccoli': {},  // pending Phase 2 multilingual fill
  'fd-peas': {},  // pending Phase 2 multilingual fill
  'fd-corn': {},  // pending Phase 2 multilingual fill
  'fd-tomato': {},  // pending Phase 2 multilingual fill
  'fd-cucumber': {},  // pending Phase 2 multilingual fill
  'fd-lettuce': {},  // pending Phase 2 multilingual fill
  'fd-spinach': {},  // pending Phase 2 multilingual fill
  'fd-potato': {},  // pending Phase 2 multilingual fill
  'fd-sweet-potato': {},  // pending Phase 2 multilingual fill
  'fd-strawberry': {},  // pending Phase 2 multilingual fill
  'fd-blueberry': {},  // pending Phase 2 multilingual fill
  'fd-grapes': {},  // pending Phase 2 multilingual fill
  'fd-watermelon': {},  // pending Phase 2 multilingual fill
  'fd-orange': {},  // pending Phase 2 multilingual fill
  'fd-pear': {},  // pending Phase 2 multilingual fill
  'fd-peach': {},  // pending Phase 2 multilingual fill
  'fd-mango': {},  // pending Phase 2 multilingual fill
  'fd-pineapple': {},  // pending Phase 2 multilingual fill
  'fd-cake': {},  // pending Phase 2 multilingual fill
  'fd-cupcake': {},  // pending Phase 2 multilingual fill
  'fd-brownie': {},  // pending Phase 2 multilingual fill
  'fd-donut': {},  // pending Phase 2 multilingual fill
  'fd-muffin': {},  // pending Phase 2 multilingual fill
  'fd-pie': {},  // pending Phase 2 multilingual fill
  'fd-pudding': {},  // pending Phase 2 multilingual fill
  'fd-jello': {},  // pending Phase 2 multilingual fill
  'fd-candy': {},  // pending Phase 2 multilingual fill
  'fd-chocolate': {},  // pending Phase 2 multilingual fill
  'fd-lollipop': {},  // pending Phase 2 multilingual fill
  'fd-gum': {},  // pending Phase 2 multilingual fill
  'fd-soda': {},  // pending Phase 2 multilingual fill
  'fd-tea': {},  // pending Phase 2 multilingual fill
  'fd-hot-chocolate': {},  // pending Phase 2 multilingual fill
  'fd-lemonade': {},  // pending Phase 2 multilingual fill
  'fd-spoon': {},  // pending Phase 2 multilingual fill
  'fd-fork': {},  // pending Phase 2 multilingual fill
  'fd-knife': {},  // pending Phase 2 multilingual fill
  'fd-plate': {},  // pending Phase 2 multilingual fill
  'fd-bowl': {},  // pending Phase 2 multilingual fill
  'fd-cup': {},  // pending Phase 2 multilingual fill
  'fd-straw': {},  // pending Phase 2 multilingual fill
  'fd-napkin': {},  // pending Phase 2 multilingual fill
  'fd-bib': {},  // pending Phase 2 multilingual fill
  'fd-open-it-please': {},  // pending Phase 2 multilingual fill
  'fd-cut-it-up-please': {},  // pending Phase 2 multilingual fill
  'fd-not-too-hot': {},  // pending Phase 2 multilingual fill
  'fd-i-am-allergic': {},  // pending Phase 2 multilingual fill
  'pl-backyard': {},  // pending Phase 2 multilingual fill
  'pl-front-yard': {},  // pending Phase 2 multilingual fill
  'pl-garden': {},  // pending Phase 2 multilingual fill
  'pl-driveway': {},  // pending Phase 2 multilingual fill
  'pl-living-room': {},  // pending Phase 2 multilingual fill
  'pl-dining-room': {},  // pending Phase 2 multilingual fill
  'pl-garage': {},  // pending Phase 2 multilingual fill
  'pl-basement': {},  // pending Phase 2 multilingual fill
  'pl-attic': {},  // pending Phase 2 multilingual fill
  'pl-hospital': {},  // pending Phase 2 multilingual fill
  'pl-doctor-office': {},  // pending Phase 2 multilingual fill
  'pl-dentist-office': {},  // pending Phase 2 multilingual fill
  'pl-pharmacy': {},  // pending Phase 2 multilingual fill
  'pl-grocery-store': {},  // pending Phase 2 multilingual fill
  'pl-mall': {},  // pending Phase 2 multilingual fill
  'pl-pet-store': {},  // pending Phase 2 multilingual fill
  'pl-toy-store': {},  // pending Phase 2 multilingual fill
  'pl-movie-theater': {},  // pending Phase 2 multilingual fill
  'pl-bowling-alley': {},  // pending Phase 2 multilingual fill
  'pl-arcade': {},  // pending Phase 2 multilingual fill
  'pl-beach': {},  // pending Phase 2 multilingual fill
  'pl-lake': {},  // pending Phase 2 multilingual fill
  'pl-mountain': {},  // pending Phase 2 multilingual fill
  'pl-forest': {},  // pending Phase 2 multilingual fill
  'pl-camp': {},  // pending Phase 2 multilingual fill
  'pl-zoo': {},  // pending Phase 2 multilingual fill
  'pl-aquarium': {},  // pending Phase 2 multilingual fill
  'pl-museum': {},  // pending Phase 2 multilingual fill
  'pl-farm': {},  // pending Phase 2 multilingual fill
  'pl-church': {},  // pending Phase 2 multilingual fill
  'pl-temple': {},  // pending Phase 2 multilingual fill
  'pl-mosque': {},  // pending Phase 2 multilingual fill
  'pl-synagogue': {},  // pending Phase 2 multilingual fill
  'pl-bus-stop': {},  // pending Phase 2 multilingual fill
  'pl-train-station': {},  // pending Phase 2 multilingual fill
  'pl-airport': {},  // pending Phase 2 multilingual fill
  'sw-backpack': {},  // pending Phase 2 multilingual fill
  'sw-lunchbox': {},  // pending Phase 2 multilingual fill
  'sw-folder': {},  // pending Phase 2 multilingual fill
  'sw-notebook': {},  // pending Phase 2 multilingual fill
  'sw-crayons': {},  // pending Phase 2 multilingual fill
  'sw-markers': {},  // pending Phase 2 multilingual fill
  'sw-scissors': {},  // pending Phase 2 multilingual fill
  'sw-glue': {},  // pending Phase 2 multilingual fill
  'sw-tape': {},  // pending Phase 2 multilingual fill
  'sw-eraser': {},  // pending Phase 2 multilingual fill
  'sw-ruler': {},  // pending Phase 2 multilingual fill
  'sw-whiteboard': {},  // pending Phase 2 multilingual fill
  'sw-smart-board': {},  // pending Phase 2 multilingual fill
  'sw-projector': {},  // pending Phase 2 multilingual fill
  'sw-math': {},  // pending Phase 2 multilingual fill
  'sw-reading': {},  // pending Phase 2 multilingual fill
  'sw-writing': {},  // pending Phase 2 multilingual fill
  'sw-spelling': {},  // pending Phase 2 multilingual fill
  'sw-science': {},  // pending Phase 2 multilingual fill
  'sw-social-studies': {},  // pending Phase 2 multilingual fill
  'sw-history': {},  // pending Phase 2 multilingual fill
  'sw-pe': {},  // pending Phase 2 multilingual fill
  'sw-gym': {},  // pending Phase 2 multilingual fill
  'sw-recess-time': {},  // pending Phase 2 multilingual fill
  'sw-library-time': {},  // pending Phase 2 multilingual fill
  'sw-story-time': {},  // pending Phase 2 multilingual fill
  'sw-circle-time': {},  // pending Phase 2 multilingual fill
  'sw-lunch-time': {},  // pending Phase 2 multilingual fill
  'sw-snack-time': {},  // pending Phase 2 multilingual fill
  'sw-worksheet': {},  // pending Phase 2 multilingual fill
  'sw-quiz': {},  // pending Phase 2 multilingual fill
  'sw-test': {},  // pending Phase 2 multilingual fill
  'sw-project': {},  // pending Phase 2 multilingual fill
  'sw-field-trip': {},  // pending Phase 2 multilingual fill
  'sw-assembly': {},  // pending Phase 2 multilingual fill
  'sw-bus-ride': {},  // pending Phase 2 multilingual fill
  'hb-hair': {},  // pending Phase 2 multilingual fill
  'hb-face': {},  // pending Phase 2 multilingual fill
  'hb-forehead': {},  // pending Phase 2 multilingual fill
  'hb-cheek': {},  // pending Phase 2 multilingual fill
  'hb-chin': {},  // pending Phase 2 multilingual fill
  'hb-lips': {},  // pending Phase 2 multilingual fill
  'hb-tongue': {},  // pending Phase 2 multilingual fill
  'hb-throat': {},  // pending Phase 2 multilingual fill
  'hb-neck': {},  // pending Phase 2 multilingual fill
  'hb-shoulder': {},  // pending Phase 2 multilingual fill
  'hb-elbow': {},  // pending Phase 2 multilingual fill
  'hb-wrist': {},  // pending Phase 2 multilingual fill
  'hb-finger': {},  // pending Phase 2 multilingual fill
  'hb-thumb': {},  // pending Phase 2 multilingual fill
  'hb-knuckle': {},  // pending Phase 2 multilingual fill
  'hb-knee': {},  // pending Phase 2 multilingual fill
  'hb-ankle': {},  // pending Phase 2 multilingual fill
  'hb-toe': {},  // pending Phase 2 multilingual fill
  'hb-heel': {},  // pending Phase 2 multilingual fill
  'hb-chest': {},  // pending Phase 2 multilingual fill
  'hb-belly': {},  // pending Phase 2 multilingual fill
  'hb-hip': {},  // pending Phase 2 multilingual fill
  'hb-bottom': {},  // pending Phase 2 multilingual fill
  'hb-skin': {},  // pending Phase 2 multilingual fill
  'hb-bone': {},  // pending Phase 2 multilingual fill
  'hb-muscle': {},  // pending Phase 2 multilingual fill
  'hb-headache': {},  // pending Phase 2 multilingual fill
  'hb-stomachache': {},  // pending Phase 2 multilingual fill
  'hb-earache': {},  // pending Phase 2 multilingual fill
  'hb-toothache': {},  // pending Phase 2 multilingual fill
  'hb-sore-throat': {},  // pending Phase 2 multilingual fill
  'hb-cough': {},  // pending Phase 2 multilingual fill
  'hb-sneeze': {},  // pending Phase 2 multilingual fill
  'hb-runny-nose': {},  // pending Phase 2 multilingual fill
  'hb-stuffy-nose': {},  // pending Phase 2 multilingual fill
  'hb-fever': {},  // pending Phase 2 multilingual fill
  'hb-chills': {},  // pending Phase 2 multilingual fill
  'hb-shaking': {},  // pending Phase 2 multilingual fill
  'hb-dizzy-spell': {},  // pending Phase 2 multilingual fill
  'hb-bruise': {},  // pending Phase 2 multilingual fill
  'hb-cut': {},  // pending Phase 2 multilingual fill
  'hb-scrape': {},  // pending Phase 2 multilingual fill
  'hb-bump': {},  // pending Phase 2 multilingual fill
  'hb-bandage': {},  // pending Phase 2 multilingual fill
  'hb-itchy-spot': {},  // pending Phase 2 multilingual fill
  'hb-rash': {},  // pending Phase 2 multilingual fill
  'hb-allergic-reaction': {},  // pending Phase 2 multilingual fill
  'hb-pain': {},  // pending Phase 2 multilingual fill
  'hb-sharp-pain': {},  // pending Phase 2 multilingual fill
  'hb-dull-pain': {},  // pending Phase 2 multilingual fill
  'hb-burning': {},  // pending Phase 2 multilingual fill
  'hb-vitamins': {},  // pending Phase 2 multilingual fill
  'hb-inhaler': {},  // pending Phase 2 multilingual fill
  'hb-epipen': {},  // pending Phase 2 multilingual fill
  'hb-pill': {},  // pending Phase 2 multilingual fill
  'hb-drops': {},  // pending Phase 2 multilingual fill
  'hb-doctor-visit': {},  // pending Phase 2 multilingual fill
  'hb-shot': {},  // pending Phase 2 multilingual fill
  'hb-x-ray': {},  // pending Phase 2 multilingual fill
  'hb-check-up': {},  // pending Phase 2 multilingual fill
  'hb-wash-my-hands': {},  // pending Phase 2 multilingual fill
  'hb-brush-my-teeth': {},  // pending Phase 2 multilingual fill
  'ti-right-now': {},  // pending Phase 2 multilingual fill
  'ti-in-a-minute': {},  // pending Phase 2 multilingual fill
  'ti-soon': {},  // pending Phase 2 multilingual fill
  'ti-later-today': {},  // pending Phase 2 multilingual fill
  'ti-tonight': {},  // pending Phase 2 multilingual fill
  'ti-this-morning': {},  // pending Phase 2 multilingual fill
  'ti-this-afternoon': {},  // pending Phase 2 multilingual fill
  'ti-this-evening': {},  // pending Phase 2 multilingual fill
  'ti-last-night': {},  // pending Phase 2 multilingual fill
  'ti-all-day': {},  // pending Phase 2 multilingual fill
  'ti-all-night': {},  // pending Phase 2 multilingual fill
  'ti-a-long-time': {},  // pending Phase 2 multilingual fill
  'ti-a-short-time': {},  // pending Phase 2 multilingual fill
  'ti-a-while-ago': {},  // pending Phase 2 multilingual fill
  'ti-weekend': {},  // pending Phase 2 multilingual fill
  'ti-weekday': {},  // pending Phase 2 multilingual fill
  'ti-monday': {},  // pending Phase 2 multilingual fill
  'ti-tuesday': {},  // pending Phase 2 multilingual fill
  'ti-wednesday': {},  // pending Phase 2 multilingual fill
  'ti-thursday': {},  // pending Phase 2 multilingual fill
  'ti-friday': {},  // pending Phase 2 multilingual fill
  'ti-saturday': {},  // pending Phase 2 multilingual fill
  'ti-sunday': {},  // pending Phase 2 multilingual fill
  'ti-birthday': {},  // pending Phase 2 multilingual fill
  'ti-holiday': {},  // pending Phase 2 multilingual fill
  'an-puppy': {},  // pending Phase 2 multilingual fill
  'an-kitten': {},  // pending Phase 2 multilingual fill
  'an-hamster': {},  // pending Phase 2 multilingual fill
  'an-guinea-pig': {},  // pending Phase 2 multilingual fill
  'an-turtle': {},  // pending Phase 2 multilingual fill
  'an-frog': {},  // pending Phase 2 multilingual fill
  'an-snake': {},  // pending Phase 2 multilingual fill
  'an-lizard': {},  // pending Phase 2 multilingual fill
  'an-spider': {},  // pending Phase 2 multilingual fill
  'an-bug': {},  // pending Phase 2 multilingual fill
  'an-bee': {},  // pending Phase 2 multilingual fill
  'an-ant': {},  // pending Phase 2 multilingual fill
  'an-lion': {},  // pending Phase 2 multilingual fill
  'an-tiger': {},  // pending Phase 2 multilingual fill
  'an-monkey': {},  // pending Phase 2 multilingual fill
  'an-giraffe': {},  // pending Phase 2 multilingual fill
  'an-zebra': {},  // pending Phase 2 multilingual fill
  'an-hippo': {},  // pending Phase 2 multilingual fill
  'an-penguin': {},  // pending Phase 2 multilingual fill
  'an-owl': {},  // pending Phase 2 multilingual fill
  'an-eagle': {},  // pending Phase 2 multilingual fill
  'an-parrot': {},  // pending Phase 2 multilingual fill
  'an-chicken': {},  // pending Phase 2 multilingual fill
  'an-rooster': {},  // pending Phase 2 multilingual fill
  'an-sheep': {},  // pending Phase 2 multilingual fill
  'an-goat': {},  // pending Phase 2 multilingual fill
  'an-donkey': {},  // pending Phase 2 multilingual fill
  'an-dolphin': {},  // pending Phase 2 multilingual fill
  'an-whale': {},  // pending Phase 2 multilingual fill
  'an-shark': {},  // pending Phase 2 multilingual fill
  'an-octopus': {},  // pending Phase 2 multilingual fill
  'an-crab': {},  // pending Phase 2 multilingual fill
  'an-starfish': {},  // pending Phase 2 multilingual fill
  'an-my-pet': {},  // pending Phase 2 multilingual fill
  'an-my-dog': {},  // pending Phase 2 multilingual fill
  'an-my-cat': {},  // pending Phase 2 multilingual fill
  'co-gray': {},  // pending Phase 2 multilingual fill
  'co-silver': {},  // pending Phase 2 multilingual fill
  'co-gold': {},  // pending Phase 2 multilingual fill
  'co-beige': {},  // pending Phase 2 multilingual fill
  'co-tan': {},  // pending Phase 2 multilingual fill
  'co-light-blue': {},  // pending Phase 2 multilingual fill
  'co-dark-blue': {},  // pending Phase 2 multilingual fill
  'co-light-green': {},  // pending Phase 2 multilingual fill
  'co-dark-green': {},  // pending Phase 2 multilingual fill
  'co-light-pink': {},  // pending Phase 2 multilingual fill
  'co-hot-pink': {},  // pending Phase 2 multilingual fill
  'co-rainbow': {},  // pending Phase 2 multilingual fill
  'co-my-favorite-color': {},  // pending Phase 2 multilingual fill
  'cl-t-shirt': {},  // pending Phase 2 multilingual fill
  'cl-sweater': {},  // pending Phase 2 multilingual fill
  'cl-sweatshirt': {},  // pending Phase 2 multilingual fill
  'cl-hoodie': {},  // pending Phase 2 multilingual fill
  'cl-coat': {},  // pending Phase 2 multilingual fill
  'cl-shorts': {},  // pending Phase 2 multilingual fill
  'cl-skirt': {},  // pending Phase 2 multilingual fill
  'cl-leggings': {},  // pending Phase 2 multilingual fill
  'cl-sandals': {},  // pending Phase 2 multilingual fill
  'cl-sneakers': {},  // pending Phase 2 multilingual fill
  'cl-mittens': {},  // pending Phase 2 multilingual fill
  'cl-gloves': {},  // pending Phase 2 multilingual fill
  'cl-scarf': {},  // pending Phase 2 multilingual fill
  'cl-belt': {},  // pending Phase 2 multilingual fill
  'cl-backpack': {},  // pending Phase 2 multilingual fill
  'cl-helmet': {},  // pending Phase 2 multilingual fill
  'cl-glasses': {},  // pending Phase 2 multilingual fill
  'cl-sunglasses': {},  // pending Phase 2 multilingual fill
  'cl-diaper': {},  // pending Phase 2 multilingual fill
  'cl-pull-up': {},  // pending Phase 2 multilingual fill
  'tr-stroller': {},  // pending Phase 2 multilingual fill
  'tr-tricycle': {},  // pending Phase 2 multilingual fill
  'tr-skateboard': {},  // pending Phase 2 multilingual fill
  'tr-roller-skates': {},  // pending Phase 2 multilingual fill
  'tr-subway': {},  // pending Phase 2 multilingual fill
  'tr-taxi': {},  // pending Phase 2 multilingual fill
  'tr-helicopter': {},  // pending Phase 2 multilingual fill
  'tr-rocket': {},  // pending Phase 2 multilingual fill
  'tr-tractor': {},  // pending Phase 2 multilingual fill
  'tr-fire-truck': {},  // pending Phase 2 multilingual fill
  'tr-police-car': {},  // pending Phase 2 multilingual fill
  'tr-ambulance': {},  // pending Phase 2 multilingual fill
  'tr-ferry': {},  // pending Phase 2 multilingual fill
  'tr-sled': {},  // pending Phase 2 multilingual fill
  'tr-drive': {},  // pending Phase 2 multilingual fill
  'tr-ride': {},  // pending Phase 2 multilingual fill
  'we-foggy': {},  // pending Phase 2 multilingual fill
  'we-rainbow': {},  // pending Phase 2 multilingual fill
  'we-lightning': {},  // pending Phase 2 multilingual fill
  'we-thunder': {},  // pending Phase 2 multilingual fill
  'we-tornado': {},  // pending Phase 2 multilingual fill
  'we-hurricane': {},  // pending Phase 2 multilingual fill
  'we-earthquake': {},  // pending Phase 2 multilingual fill
  'we-warm-out': {},  // pending Phase 2 multilingual fill
  'we-cool-out': {},  // pending Phase 2 multilingual fill
  'we-freezing': {},  // pending Phase 2 multilingual fill
  'we-wear-a-coat': {},  // pending Phase 2 multilingual fill
  'we-wear-shorts': {},  // pending Phase 2 multilingual fill
  'tf-stuffed-animal': {},  // pending Phase 2 multilingual fill
  'tf-action-figure': {},  // pending Phase 2 multilingual fill
  'tf-lego': {},  // pending Phase 2 multilingual fill
  'tf-train-set': {},  // pending Phase 2 multilingual fill
  'tf-card-game': {},  // pending Phase 2 multilingual fill
  'tf-board-game': {},  // pending Phase 2 multilingual fill
  'tf-video-game': {},  // pending Phase 2 multilingual fill
  'tf-crayons': {},  // pending Phase 2 multilingual fill
  'tf-stickers': {},  // pending Phase 2 multilingual fill
  'tf-sandbox': {},  // pending Phase 2 multilingual fill
  'tf-trampoline': {},  // pending Phase 2 multilingual fill
  'tf-sprinkler': {},  // pending Phase 2 multilingual fill
  'tf-story': {},  // pending Phase 2 multilingual fill
  'tf-song': {},  // pending Phase 2 multilingual fill
  'tf-cartoon': {},  // pending Phase 2 multilingual fill

};

export function getPhraseText(phraseId: string, lang: SupportedLanguage, fallback: string): string {
  if (lang === 'en') return fallback;
  return T[phraseId]?.[lang] ?? fallback;
}
