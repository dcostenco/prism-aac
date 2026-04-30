import { OrderingSequenceData } from '@/types';

export const TEMPLATE_ORDERING_SEQUENCES: OrderingSequenceData[] = [
  {
    id: 'seq-chipotle', name: 'Chipotle', categoryId: 'food-ordering', sortOrder: 0,
    steps: [
      { id: 'chip-opener', label: 'Start your order', stepOrder: 0, options: [
        { id: 'chip-o1', text: 'Can I get a...', sortOrder: 0 },
        { id: 'chip-o2', text: "I'd like to order...", sortOrder: 1 },
        { id: 'chip-o3', text: 'For here please', sortOrder: 2 },
        { id: 'chip-o4', text: 'To go please', sortOrder: 3 },
      ]},
      { id: 'chip-base', label: 'Choose your base', stepOrder: 1, options: [
        { id: 'chip-b1', text: 'Burrito', sortOrder: 0 },
        { id: 'chip-b2', text: 'Bowl', sortOrder: 1 },
        { id: 'chip-b3', text: 'Tacos', sortOrder: 2 },
        { id: 'chip-b4', text: 'Quesadilla', sortOrder: 3 },
        { id: 'chip-b5', text: 'Salad', sortOrder: 4 },
      ]},
      { id: 'chip-protein', label: 'Choose your protein', stepOrder: 2, options: [
        { id: 'chip-p1', text: 'Chicken', sortOrder: 0 },
        { id: 'chip-p2', text: 'Steak', sortOrder: 1 },
        { id: 'chip-p3', text: 'Barbacoa', sortOrder: 2 },
        { id: 'chip-p4', text: 'Carnitas', sortOrder: 3 },
        { id: 'chip-p5', text: 'Sofritas', sortOrder: 4 },
        { id: 'chip-p6', text: 'Veggie', sortOrder: 5 },
      ]},
      { id: 'chip-toppings', label: 'Toppings', stepOrder: 3, options: [
        { id: 'chip-t1', text: 'Rice', sortOrder: 0 },
        { id: 'chip-t2', text: 'Beans', sortOrder: 1 },
        { id: 'chip-t3', text: 'Cheese', sortOrder: 2 },
        { id: 'chip-t4', text: 'Sour cream', sortOrder: 3 },
        { id: 'chip-t5', text: 'Guacamole', sortOrder: 4 },
        { id: 'chip-t6', text: 'Salsa', sortOrder: 5 },
        { id: 'chip-t7', text: 'Lettuce', sortOrder: 6 },
        { id: 'chip-t8', text: 'Corn', sortOrder: 7 },
      ]},
      { id: 'chip-finish', label: 'Finish', stepOrder: 4, options: [
        { id: 'chip-f1', text: "That's everything", sortOrder: 0 },
        { id: 'chip-f2', text: 'And a drink please', sortOrder: 1 },
        { id: 'chip-f3', text: 'And chips please', sortOrder: 2 },
        { id: 'chip-f4', text: 'Thank you', sortOrder: 3 },
      ]},
    ],
  },
  {
    id: 'seq-general-restaurant', name: 'General Restaurant', categoryId: 'food-ordering', sortOrder: 1,
    steps: [
      { id: 'gen-opener', label: 'Start', stepOrder: 0, options: [
        { id: 'gen-o1', text: 'Can I see the menu?', sortOrder: 0 },
        { id: 'gen-o2', text: "I'd like to order", sortOrder: 1 },
        { id: 'gen-o3', text: 'Table for two please', sortOrder: 2 },
      ]},
      { id: 'gen-order', label: 'Order', stepOrder: 1, options: [
        { id: 'gen-r1', text: "I'll have the...", sortOrder: 0 },
        { id: 'gen-r2', text: 'Can I get...', sortOrder: 1 },
        { id: 'gen-r3', text: 'What do you recommend?', sortOrder: 2 },
      ]},
      { id: 'gen-modify', label: 'Modify', stepOrder: 2, options: [
        { id: 'gen-m1', text: 'No onions please', sortOrder: 0 },
        { id: 'gen-m2', text: 'On the side', sortOrder: 1 },
        { id: 'gen-m3', text: 'Extra please', sortOrder: 2 },
        { id: 'gen-m4', text: 'Is that gluten free?', sortOrder: 3 },
      ]},
      { id: 'gen-finish', label: 'Finish', stepOrder: 3, options: [
        { id: 'gen-f1', text: "That's all, thank you", sortOrder: 0 },
        { id: 'gen-f2', text: 'Can I have the check?', sortOrder: 1 },
        { id: 'gen-f3', text: 'It was delicious', sortOrder: 2 },
      ]},
    ],
  },
];
