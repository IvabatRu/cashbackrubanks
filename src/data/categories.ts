import type { Category } from '../lib/types';

/**
 * Встроенные категории кешбэка — то, что реально предлагают российские банки.
 * Свои категории пользователь добавляет сам, они хранятся отдельно.
 *
 * id пишем латиницей: он попадает в сохранённые данные, и если однажды
 * захочется переименовать категорию, данные не потеряются.
 */
export const BUILT_IN_CATEGORIES: Category[] = [
  { id: 'all', name: 'Все покупки', emoji: '🛍️' },
  { id: 'supermarkets', name: 'Супермаркеты', emoji: '🛒' },
  { id: 'convenience', name: 'Продукты у дома', emoji: '🏪' },
  { id: 'pharmacy', name: 'Аптеки', emoji: '💊' },
  { id: 'fuel', name: 'АЗС', emoji: '⛽' },
  { id: 'restaurants', name: 'Кафе и рестораны', emoji: '🍽️' },
  { id: 'fastfood', name: 'Фастфуд', emoji: '🍔' },
  { id: 'food-delivery', name: 'Доставка еды', emoji: '🥡' },
  { id: 'taxi', name: 'Такси', emoji: '🚕' },
  { id: 'transport', name: 'Транспорт', emoji: '🚌' },
  { id: 'carsharing', name: 'Каршеринг', emoji: '🚗' },
  { id: 'flights', name: 'Авиабилеты', emoji: '✈️' },
  { id: 'trains', name: 'Ж/д билеты', emoji: '🚆' },
  { id: 'hotels', name: 'Отели', emoji: '🏨' },
  { id: 'travel', name: 'Турагентства', emoji: '🧳' },
  { id: 'entertainment', name: 'Развлечения', emoji: '🎭' },
  { id: 'cinema', name: 'Кино', emoji: '🎬' },
  { id: 'sport', name: 'Спорт и фитнес', emoji: '🏋️' },
  { id: 'sport-goods', name: 'Спортивные товары', emoji: '🎽' },
  { id: 'beauty', name: 'Красота', emoji: '💅' },
  { id: 'cosmetics', name: 'Косметика и парфюмерия', emoji: '💄' },
  { id: 'clothes', name: 'Одежда и обувь', emoji: '👗' },
  { id: 'kids', name: 'Детские товары', emoji: '🧸' },
  { id: 'electronics', name: 'Электроника', emoji: '📱' },
  { id: 'home', name: 'Дом и ремонт', emoji: '🔨' },
  { id: 'furniture', name: 'Мебель', emoji: '🛋️' },
  { id: 'pets', name: 'Товары для животных', emoji: '🐶' },
  { id: 'flowers', name: 'Цветы', emoji: '💐' },
  { id: 'books', name: 'Книги', emoji: '📚' },
  { id: 'marketplaces', name: 'Маркетплейсы', emoji: '📦' },
  { id: 'subscriptions', name: 'Онлайн-подписки', emoji: '📺' },
  { id: 'games', name: 'Игры', emoji: '🎮' },
  { id: 'telecom', name: 'Связь и интернет', emoji: '📶' },
  { id: 'utilities', name: 'ЖКХ', emoji: '🏠' },
  { id: 'medicine', name: 'Медицина', emoji: '🩺' },
  { id: 'education', name: 'Образование', emoji: '🎓' },
  { id: 'auto-service', name: 'Автоуслуги', emoji: '🔧' },
  { id: 'jewelry', name: 'Ювелирные изделия', emoji: '💎' },
  { id: 'duty-free', name: 'Duty Free', emoji: '🛂' },
  { id: 'charity', name: 'Благотворительность', emoji: '❤️' },
];

/** Эмодзи, из которых можно выбрать значок для своей категории. */
export const EMOJI_CHOICES = [
  '🛍️', '🛒', '💊', '⛽', '🍽️', '🍔', '🥡', '🚕', '🚌', '🚗',
  '✈️', '🚆', '🏨', '🧳', '🎭', '🎬', '🏋️', '💅', '💄', '👗',
  '🧸', '📱', '🔨', '🛋️', '🐶', '💐', '📚', '📦', '📺', '🎮',
  '📶', '🏠', '🩺', '🎓', '🔧', '💎', '☕', '🍺', '🎂', '🎁',
  '💳', '💰', '⭐', '🔥', '🎯', '🧾', '🪙', '❤️',
];
