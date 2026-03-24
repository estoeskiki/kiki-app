import type { MenuItem, CustomizationGroup } from '@/data/types';

// ─── Shared customization groups ───────────────────────────────────────────────

const burgerSizeGroup: CustomizationGroup = {
  id: 'burger-size',
  name: 'Patty Size',
  required: true,
  maxSelections: 1,
  options: [
    { id: 'size-single', name: 'Single', priceModifier: -200 },
    { id: 'size-double', name: 'Double', priceModifier: 0 },
    { id: 'size-triple', name: 'Triple', priceModifier: 300 },
  ],
};

const burgerExtrasGroup: CustomizationGroup = {
  id: 'burger-extras',
  name: 'Extras',
  required: false,
  maxSelections: 4,
  options: [
    { id: 'extra-bacon', name: 'Bacon', priceModifier: 199 },
    { id: 'extra-cheese', name: 'Extra Cheese', priceModifier: 99 },
    { id: 'extra-jalapenos', name: 'Jalapeños', priceModifier: 79 },
    { id: 'extra-avocado', name: 'Avocado', priceModifier: 149 },
  ],
};

const sideSizeGroup: CustomizationGroup = {
  id: 'side-size',
  name: 'Size',
  required: true,
  maxSelections: 1,
  options: [
    { id: 'side-regular', name: 'Regular', priceModifier: 0 },
    { id: 'side-large', name: 'Large', priceModifier: 150 },
  ],
};

const drinkSizeGroup: CustomizationGroup = {
  id: 'drink-size',
  name: 'Size',
  required: true,
  maxSelections: 1,
  options: [
    { id: 'drink-small', name: 'Small', priceModifier: -50 },
    { id: 'drink-medium', name: 'Medium', priceModifier: 0 },
    { id: 'drink-large', name: 'Large', priceModifier: 100 },
  ],
};

const milkshakeFlavorGroup: CustomizationGroup = {
  id: 'milkshake-flavor',
  name: 'Flavor',
  required: true,
  maxSelections: 1,
  options: [
    { id: 'flavor-chocolate', name: 'Chocolate', priceModifier: 0 },
    { id: 'flavor-vanilla', name: 'Vanilla', priceModifier: 0 },
    { id: 'flavor-strawberry', name: 'Strawberry', priceModifier: 0 },
    { id: 'flavor-cookies-cream', name: 'Cookies & Cream', priceModifier: 0 },
  ],
};

const sundaeFlavorGroup: CustomizationGroup = {
  id: 'sundae-flavor',
  name: 'Flavor',
  required: true,
  maxSelections: 1,
  options: [
    { id: 'sundae-chocolate', name: 'Chocolate', priceModifier: 0 },
    { id: 'sundae-vanilla', name: 'Vanilla', priceModifier: 0 },
    { id: 'sundae-strawberry', name: 'Strawberry', priceModifier: 0 },
  ],
};

const comboDrinkGroup: CustomizationGroup = {
  id: 'combo-drink',
  name: 'Choose Your Drink',
  required: true,
  maxSelections: 1,
  options: [
    { id: 'combo-coca-cola', name: 'Coca-Cola', priceModifier: 0 },
    { id: 'combo-lemonade', name: 'Lemonade', priceModifier: 0 },
    { id: 'combo-iced-tea', name: 'Iced Tea', priceModifier: 0 },
    { id: 'combo-milkshake', name: 'Milkshake', priceModifier: 200 },
  ],
};

// ─── Menu items ────────────────────────────────────────────────────────────────

export const menuItems: MenuItem[] = [
  // ── Burgers ────────────────────────────────────────────────────────────────
  {
    id: 'burger-classic-smash',
    categoryId: 'cat-burgers',
    name: 'Classic Smash',
    description:
      'Our signature smashed patty with American cheese, pickles, onions, and Kiki sauce on a toasted brioche bun.',
    price: 1099,
    image: '',
    available: true,
    popular: true,
    customizations: [burgerSizeGroup, burgerExtrasGroup],
  },
  {
    id: 'burger-bbq-bacon',
    categoryId: 'cat-burgers',
    name: 'BBQ Bacon',
    description:
      'Smoky BBQ sauce, crispy bacon, cheddar cheese, and caramelized onions stacked on a toasted brioche bun.',
    price: 1299,
    image: '',
    available: true,
    popular: true,
    customizations: [burgerSizeGroup, burgerExtrasGroup],
  },
  {
    id: 'burger-mushroom-swiss',
    categoryId: 'cat-burgers',
    name: 'Mushroom Swiss',
    description:
      'Sautéed wild mushrooms, melted Swiss cheese, and garlic aioli on a toasted brioche bun. Earthy perfection.',
    price: 1249,
    image: '',
    available: true,
    popular: false,
    customizations: [burgerSizeGroup, burgerExtrasGroup],
  },
  {
    id: 'burger-spicy-jalapeno',
    categoryId: 'cat-burgers',
    name: 'Spicy Jalapeño',
    description:
      'Pepper jack cheese, fresh jalapeños, chipotle mayo, and crunchy tortilla strips. Bring the heat!',
    price: 1199,
    image: '',
    available: true,
    popular: false,
    customizations: [burgerSizeGroup, burgerExtrasGroup],
  },
  {
    id: 'burger-veggie',
    categoryId: 'cat-burgers',
    name: 'Veggie Burger',
    description:
      'House-made black bean patty with roasted red pepper, avocado, sprouts, and herb mayo. 100% plant-powered.',
    price: 1149,
    image: '',
    available: true,
    popular: false,
    customizations: [burgerSizeGroup, burgerExtrasGroup],
  },
  {
    id: 'burger-big-kiki',
    categoryId: 'cat-burgers',
    name: 'The Big Kiki',
    description:
      'Two smashed patties, double American cheese, shredded lettuce, Kiki sauce, and pickles on a triple-deck sesame bun. Our ultimate creation.',
    price: 1699,
    image: '',
    available: true,
    popular: true,
    customizations: [burgerExtrasGroup],
  },

  // ── Sides ──────────────────────────────────────────────────────────────────
  {
    id: 'side-classic-fries',
    categoryId: 'cat-sides',
    name: 'Classic Fries',
    description: 'Golden, crispy, and seasoned with our secret salt blend. The perfect sidekick.',
    price: 449,
    image: '',
    available: true,
    popular: true,
    customizations: [sideSizeGroup],
  },
  {
    id: 'side-sweet-potato-fries',
    categoryId: 'cat-sides',
    name: 'Sweet Potato Fries',
    description:
      'Hand-cut sweet potatoes fried to a crisp and dusted with cinnamon sugar. Sweet meets salty.',
    price: 549,
    image: '',
    available: true,
    popular: false,
    customizations: [sideSizeGroup],
  },
  {
    id: 'side-onion-rings',
    categoryId: 'cat-sides',
    name: 'Onion Rings',
    description:
      'Thick-cut onion rings in a crunchy beer batter, served with smoky ranch dipping sauce.',
    price: 549,
    image: '',
    available: true,
    popular: false,
    customizations: [sideSizeGroup],
  },
  {
    id: 'side-loaded-cheese-fries',
    categoryId: 'cat-sides',
    name: 'Loaded Cheese Fries',
    description:
      'Classic fries smothered in nacho cheese, crispy bacon bits, sour cream, and chives.',
    price: 749,
    image: '',
    available: true,
    popular: true,
    customizations: [sideSizeGroup],
  },
  {
    id: 'side-coleslaw',
    categoryId: 'cat-sides',
    name: 'Coleslaw',
    description: 'Creamy, tangy slaw with shredded cabbage, carrots, and a hint of apple cider vinegar.',
    price: 349,
    image: '',
    available: true,
    popular: false,
    customizations: [sideSizeGroup],
  },

  // ── Drinks ─────────────────────────────────────────────────────────────────
  {
    id: 'drink-coca-cola',
    categoryId: 'cat-drinks',
    name: 'Coca-Cola',
    description: 'Ice-cold Coca-Cola Classic. The real thing.',
    price: 299,
    image: '',
    available: true,
    popular: true,
    customizations: [drinkSizeGroup],
  },
  {
    id: 'drink-lemonade',
    categoryId: 'cat-drinks',
    name: 'Lemonade',
    description: 'Freshly squeezed lemonade made in-house daily. Tart, sweet, and refreshing.',
    price: 349,
    image: '',
    available: true,
    popular: false,
    customizations: [drinkSizeGroup],
  },
  {
    id: 'drink-iced-tea',
    categoryId: 'cat-drinks',
    name: 'Iced Tea',
    description: 'Brewed black tea served over ice. Unsweetened — add sugar to your liking.',
    price: 299,
    image: '',
    available: true,
    popular: false,
    customizations: [drinkSizeGroup],
  },
  {
    id: 'drink-milkshake',
    categoryId: 'cat-drinks',
    name: 'Milkshake',
    description: 'Thick and creamy hand-spun milkshake made with real ice cream. Choose your flavor.',
    price: 599,
    image: '',
    available: true,
    popular: true,
    customizations: [drinkSizeGroup, milkshakeFlavorGroup],
  },
  {
    id: 'drink-water',
    categoryId: 'cat-drinks',
    name: 'Water',
    description: 'Chilled bottled water. Simple and refreshing.',
    price: 199,
    image: '',
    available: true,
    popular: false,
    customizations: [drinkSizeGroup],
  },

  // ── Desserts ───────────────────────────────────────────────────────────────
  {
    id: 'dessert-chocolate-brownie',
    categoryId: 'cat-desserts',
    name: 'Chocolate Brownie',
    description:
      'Warm, fudgy brownie baked with dark chocolate chunks and topped with a dusting of powdered sugar.',
    price: 499,
    image: '',
    available: true,
    popular: true,
    customizations: [],
  },
  {
    id: 'dessert-churros',
    categoryId: 'cat-desserts',
    name: 'Churros',
    description:
      'Crispy golden churros rolled in cinnamon sugar and served with warm chocolate dipping sauce.',
    price: 449,
    image: '',
    available: true,
    popular: false,
    customizations: [],
  },
  {
    id: 'dessert-ice-cream-sundae',
    categoryId: 'cat-desserts',
    name: 'Ice Cream Sundae',
    description:
      'Two scoops of ice cream drizzled with hot fudge, whipped cream, sprinkles, and a cherry on top.',
    price: 549,
    image: '',
    available: true,
    popular: false,
    customizations: [sundaeFlavorGroup],
  },
  {
    id: 'dessert-apple-pie',
    categoryId: 'cat-desserts',
    name: 'Apple Pie',
    description:
      'Warm apple pie slice with a flaky golden crust and cinnamon-spiced filling. Just like grandma made.',
    price: 499,
    image: '',
    available: true,
    popular: false,
    customizations: [],
  },

  // ── Combos ─────────────────────────────────────────────────────────────────
  {
    id: 'combo-classic',
    categoryId: 'cat-combos',
    name: 'Classic Combo',
    description:
      'Classic Smash burger (double), Classic Fries, and your choice of drink. The go-to meal deal.',
    price: 1499,
    image: '',
    available: true,
    popular: true,
    customizations: [comboDrinkGroup],
  },
  {
    id: 'combo-bbq',
    categoryId: 'cat-combos',
    name: 'BBQ Combo',
    description:
      'BBQ Bacon burger (double), Onion Rings, and your choice of drink. Smoky, crunchy, delicious.',
    price: 1749,
    image: '',
    available: true,
    popular: false,
    customizations: [comboDrinkGroup],
  },
  {
    id: 'combo-veggie',
    categoryId: 'cat-combos',
    name: 'Veggie Combo',
    description:
      'Veggie Burger (double), Sweet Potato Fries, and your choice of drink. The plant-based feast.',
    price: 1449,
    image: '',
    available: true,
    popular: false,
    customizations: [comboDrinkGroup],
  },
  {
    id: 'combo-big-kiki',
    categoryId: 'cat-combos',
    name: 'Big Kiki Combo',
    description:
      'The Big Kiki burger, Loaded Cheese Fries, and your choice of drink. Go big or go home.',
    price: 2299,
    image: '',
    available: true,
    popular: true,
    customizations: [comboDrinkGroup],
  },
];
