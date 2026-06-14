import type { SupportedLanguage } from '@/engine/i18n';

type ObjectWordMap = Record<string, Partial<Record<SupportedLanguage, string[]>>>;

export const OBJECT_WORDS: ObjectWordMap = {
  cup:          { en: ['cup', 'drink', 'water', 'juice'], es: ['taza', 'beber', 'agua'], ru: ['чашка', 'пить', 'вода'], uk: ['чашка', 'пити', 'вода'], ro: ['cană', 'apă'], de: ['Tasse', 'trinken', 'Wasser'], ja: ['コップ', 'のむ', 'みず'], ko: ['컵', '마시다', '물'], zh: ['杯子', '喝', '水'], ar: ['كوب', 'شرب', 'ماء'] },
  fork:         { en: ['fork', 'eat', 'food'], es: ['tenedor', 'comer'], ru: ['вилка', 'есть', 'еда'], uk: ['виделка', 'їсти'], ro: ['furculiță', 'mâncare'], de: ['Gabel', 'essen'], ja: ['フォーク', 'たべる'], ko: ['포크', '먹다'], zh: ['叉子', '吃'], ar: ['شوكة', 'أكل'] },
  spoon:        { en: ['spoon', 'eat', 'soup'], es: ['cuchara', 'sopa'], ru: ['ложка', 'суп'], uk: ['ложка', 'суп'], ro: ['lingură', 'supă'], de: ['Löffel', 'Suppe'], ja: ['スプーン', 'スープ'], ko: ['숟가락', '국'], zh: ['勺子', '汤'], ar: ['ملعقة', 'شوربة'] },
  knife:        { en: ['knife', 'cut'], es: ['cuchillo', 'cortar'], ru: ['нож', 'резать'], uk: ['ніж', 'різати'], ro: ['cuțit'], de: ['Messer', 'schneiden'], ja: ['ナイフ'], ko: ['칼'], zh: ['刀'], ar: ['سكين'] },
  bowl:         { en: ['bowl', 'cereal', 'soup'], es: ['bol', 'cereal'], ru: ['миска', 'каша'], uk: ['миска', 'каша'], ro: ['bol', 'cereale'], de: ['Schüssel', 'Müsli'], ja: ['おわん'], ko: ['그릇'], zh: ['碗'], ar: ['وعاء'] },
  bottle:       { en: ['bottle', 'milk', 'water', 'drink'], es: ['botella', 'leche', 'agua'], ru: ['бутылка', 'молоко', 'вода'], uk: ['пляшка', 'молоко', 'вода'], ro: ['sticlă', 'lapte', 'apă'], de: ['Flasche', 'Milch', 'Wasser'], ja: ['ボトル', 'ぎゅうにゅう', 'みず'], ko: ['병', '우유', '물'], zh: ['瓶子', '牛奶', '水'], ar: ['زجاجة', 'حليب', 'ماء'] },
  banana:       { en: ['banana', 'fruit', 'snack'], es: ['banana', 'fruta'], ru: ['банан', 'фрукт'], uk: ['банан', 'фрукт'], ro: ['banană', 'fruct'], de: ['Banane', 'Obst'], ja: ['バナナ', 'くだもの'], ko: ['바나나', '과일'], zh: ['香蕉', '水果'], ar: ['موز', 'فاكهة'] },
  apple:        { en: ['apple', 'fruit', 'snack'], es: ['manzana', 'fruta'], ru: ['яблоко', 'фрукт'], uk: ['яблуко', 'фрукт'], ro: ['măr', 'fruct'], de: ['Apfel', 'Obst'], ja: ['りんご'], ko: ['사과'], zh: ['苹果'], ar: ['تفاح'] },
  bed:          { en: ['bed', 'sleep', 'tired', 'night'], es: ['cama', 'dormir', 'cansado'], ru: ['кровать', 'спать', 'устал'], uk: ['ліжко', 'спати', 'втомився'], ro: ['pat', 'somn'], de: ['Bett', 'schlafen', 'müde'], ja: ['ベッド', 'ねる', 'ねむい'], ko: ['침대', '자다', '졸려'], zh: ['床', '睡觉', '困'], ar: ['سرير', 'نوم', 'تعبان'] },
  book:         { en: ['book', 'read', 'story'], es: ['libro', 'leer', 'historia'], ru: ['книга', 'читать', 'сказка'], uk: ['книга', 'читати', 'казка'], ro: ['carte', 'citește', 'poveste'], de: ['Buch', 'lesen', 'Geschichte'], ja: ['ほん', 'よむ', 'おはなし'], ko: ['책', '읽다', '이야기'], zh: ['书', '读', '故事'], ar: ['كتاب', 'قراءة', 'قصة'] },
  tv:           { en: ['TV', 'watch', 'show'], es: ['tele', 'ver'], ru: ['телевизор', 'смотреть'], uk: ['телевізор', 'дивитися'], ro: ['televizor', 'uită-te'], de: ['Fernseher', 'gucken'], ja: ['テレビ', 'みる'], ko: ['TV', '보다'], zh: ['电视', '看'], ar: ['تلفزيون', 'شاهد'] },
  laptop:       { en: ['computer', 'type', 'work'], es: ['computadora', 'escribir'], ru: ['компьютер', 'печатать'], uk: ['комп\'ютер', 'друкувати'], ro: ['calculator'], de: ['Computer', 'tippen'], ja: ['パソコン'], ko: ['컴퓨터'], zh: ['电脑'], ar: ['كمبيوتر'] },
  keyboard:     { en: ['keyboard', 'type'], es: ['teclado'], ru: ['клавиатура'], uk: ['клавіатура'], ro: ['tastatură'], de: ['Tastatur'], ja: ['キーボード'], ko: ['키보드'], zh: ['键盘'], ar: ['لوحة مفاتيح'] },
  toilet:       { en: ['toilet', 'bathroom', 'potty'], es: ['baño', 'inodoro'], ru: ['туалет'], uk: ['туалет'], ro: ['toaletă', 'baie'], de: ['Toilette', 'Bad'], ja: ['トイレ', 'おてあらい'], ko: ['화장실'], zh: ['厕所', '卫生间'], ar: ['حمام', 'مرحاض'] },
  sink:         { en: ['sink', 'wash', 'hands'], es: ['lavabo', 'lavar'], ru: ['раковина', 'мыть'], uk: ['раковина', 'мити'], ro: ['chiuvetă', 'spală'], de: ['Waschbecken', 'waschen'], ja: ['せんめんだい', 'あらう'], ko: ['세면대', '씻다'], zh: ['水槽', '洗'], ar: ['حوض', 'غسل'] },
  'teddy bear': { en: ['teddy', 'bear', 'toy', 'play'], es: ['osito', 'juguete', 'jugar'], ru: ['мишка', 'игрушка', 'играть'], uk: ['ведмедик', 'іграшка', 'грати'], ro: ['ursuleț', 'jucărie'], de: ['Teddy', 'Spielzeug', 'spielen'], ja: ['くま', 'おもちゃ', 'あそぶ'], ko: ['곰인형', '장난감', '놀다'], zh: ['熊', '玩具', '玩'], ar: ['دمية', 'لعبة', 'لعب'] },
  'sports ball': { en: ['ball', 'play', 'throw', 'catch'], es: ['pelota', 'jugar', 'lanzar'], ru: ['мяч', 'играть', 'бросить'], uk: ['м\'яч', 'грати', 'кинути'], ro: ['minge', 'joacă'], de: ['Ball', 'spielen', 'werfen'], ja: ['ボール', 'あそぶ', 'なげる'], ko: ['공', '놀다', '던지다'], zh: ['球', '玩', '扔'], ar: ['كرة', 'لعب', 'رمي'] },
  toothbrush:   { en: ['brush', 'teeth', 'clean'], es: ['cepillo', 'dientes'], ru: ['зубная щётка', 'чистить'], uk: ['зубна щітка', 'чистити'], ro: ['periuță', 'dinți'], de: ['Zahnbürste', 'Zähne putzen'], ja: ['はブラシ', 'はをみがく'], ko: ['칫솔', '이닦기'], zh: ['牙刷', '刷牙'], ar: ['فرشاة أسنان', 'تنظيف'] },
  bicycle:      { en: ['bike', 'ride', 'outside'], es: ['bicicleta', 'pasear'], ru: ['велосипед', 'кататься'], uk: ['велосипед', 'кататися'], ro: ['bicicletă'], de: ['Fahrrad', 'fahren'], ja: ['じてんしゃ', 'のる'], ko: ['자전거', '타다'], zh: ['自行车', '骑'], ar: ['دراجة', 'ركوب'] },
  car:          { en: ['car', 'go', 'drive', 'ride'], es: ['carro', 'ir', 'paseo'], ru: ['машина', 'поехали', 'кататься'], uk: ['машина', 'поїхали'], ro: ['mașină', 'merge'], de: ['Auto', 'fahren'], ja: ['くるま', 'いく', 'のる'], ko: ['자동차', '가다', '타다'], zh: ['车', '走', '坐'], ar: ['سيارة', 'ركوب'] },
  dog:          { en: ['dog', 'puppy', 'pet'], es: ['perro', 'cachorro'], ru: ['собака', 'щенок'], uk: ['собака', 'цуценя'], ro: ['câine'], de: ['Hund', 'Welpe'], ja: ['いぬ', 'わんわん'], ko: ['강아지'], zh: ['狗', '小狗'], ar: ['كلب', 'جرو'] },
  cat:          { en: ['cat', 'kitty', 'pet'], es: ['gato', 'gatito'], ru: ['кошка', 'котёнок'], uk: ['кішка', 'кошеня'], ro: ['pisică'], de: ['Katze', 'Kätzchen'], ja: ['ねこ', 'にゃー'], ko: ['고양이'], zh: ['猫', '小猫'], ar: ['قطة', 'هرّة'] },
  bird:         { en: ['bird', 'fly', 'sing'], es: ['pájaro', 'volar'], ru: ['птица', 'летать'], uk: ['птах', 'летіти'], ro: ['pasăre'], de: ['Vogel', 'fliegen'], ja: ['とり', 'とぶ'], ko: ['새', '날다'], zh: ['鸟', '飞'], ar: ['طائر', 'طيران'] },
  chair:        { en: ['chair', 'sit'], es: ['silla', 'sentarse'], ru: ['стул', 'сесть'], uk: ['стілець', 'сісти'], ro: ['scaun'], de: ['Stuhl', 'sitzen'], ja: ['いす', 'すわる'], ko: ['의자', '앉다'], zh: ['椅子', '坐'], ar: ['كرسي', 'جلوس'] },
  couch:        { en: ['couch', 'sit', 'relax'], es: ['sofá', 'sentar'], ru: ['диван', 'отдыхать'], uk: ['диван', 'відпочити'], ro: ['canapea'], de: ['Sofa', 'sitzen'], ja: ['ソファー', 'すわる'], ko: ['소파', '앉다'], zh: ['沙发', '坐'], ar: ['أريكة', 'جلوس'] },
  backpack:     { en: ['backpack', 'school', 'bag'], es: ['mochila', 'escuela'], ru: ['рюкзак', 'школа'], uk: ['рюкзак', 'школа'], ro: ['ghiozdan', 'școală'], de: ['Rucksack', 'Schule'], ja: ['リュック', 'がっこう'], ko: ['가방', '학교'], zh: ['书包', '学校'], ar: ['حقيبة', 'مدرسة'] },
  clock:        { en: ['clock', 'time', 'when'], es: ['reloj', 'hora'], ru: ['часы', 'время'], uk: ['годинник', 'час'], ro: ['ceas', 'timp'], de: ['Uhr', 'Zeit'], ja: ['とけい', 'じかん'], ko: ['시계', '시간'], zh: ['钟', '时间'], ar: ['ساعة', 'وقت'] },
  remote:       { en: ['remote', 'TV', 'change'], es: ['control', 'tele'], ru: ['пульт', 'телевизор'], uk: ['пульт', 'телевізор'], ro: ['telecomandă'], de: ['Fernbedienung'], ja: ['リモコン', 'テレビ'], ko: ['리모컨', 'TV'], zh: ['遥控器', '电视'], ar: ['ريموت', 'تلفزيون'] },
  scissors:     { en: ['scissors', 'cut', 'craft'], es: ['tijeras', 'cortar'], ru: ['ножницы', 'резать'], uk: ['ножиці', 'різати'], ro: ['foarfece'], de: ['Schere', 'schneiden'], ja: ['はさみ', 'きる'], ko: ['가위', '자르다'], zh: ['剪刀', '剪'], ar: ['مقص', 'قص'] },
  'hair drier': { en: ['hair dryer', 'dry', 'hair'], es: ['secador', 'pelo'], ru: ['фен', 'сушить'], uk: ['фен', 'сушити'], ro: ['uscător', 'păr'], de: ['Föhn', 'Haare'], ja: ['ドライヤー', 'かみ'], ko: ['드라이기', '머리'], zh: ['吹风机', '头发'], ar: ['مجفف شعر'] },
};

export function getObjectWords(label: string, lang: SupportedLanguage): string[] {
  const entry = OBJECT_WORDS[label.toLowerCase()];
  if (!entry) return [];
  return entry[lang] ?? entry['en'] ?? [];
}
