const MENU = [
  {
    key: 'starter',
    title: 'Starters',
    items: [
      { menuItemId: 'starter_samosa', name: 'Samosa', price: 80, category: 'starter' },
      { menuItemId: 'starter_soup', name: 'Hot Soup', price: 120, category: 'starter' },
    ],
  },
  {
    key: 'main',
    title: 'Main Course',
    items: [
      { menuItemId: 'main_paneer', name: 'Paneer Curry', price: 220, category: 'main' },
      { menuItemId: 'main_biryani', name: 'Veg Biryani', price: 260, category: 'main' },
      { menuItemId: 'main_burger', name: 'Cheese Burger', price: 190, category: 'main' },
    ],
  },
  {
    key: 'drinks',
    title: 'Drinks',
    items: [
      { menuItemId: 'drink_juice', name: 'Fresh Juice', price: 90, category: 'drinks' },
      { menuItemId: 'drink_coke', name: 'Cold Coke', price: 80, category: 'drinks' },
      { menuItemId: 'drink_water', name: 'Mineral Water', price: 40, category: 'drinks' },
    ],
  },
  {
    key: 'dessert',
    title: 'Dessert',
    items: [
      { menuItemId: 'dessert_icecream', name: 'Ice Cream', price: 110, category: 'dessert' },
      { menuItemId: 'dessert_gulabjamun', name: 'Gulab Jamun', price: 130, category: 'dessert' },
    ],
  },
]

module.exports = { MENU }

