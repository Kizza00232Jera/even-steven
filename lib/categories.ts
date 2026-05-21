export type Category =
  // General (§12)
  | 'Games'
  | 'Movies'
  | 'Movies / Games'
  | 'Music'
  | 'Sports'
  | 'Other'
  // Food & Drink (§12)
  | 'Dining Out'
  | 'Groceries'
  | 'Liquor'
  // Home (§12)
  | 'Furniture'
  | 'Household Supplies'
  | 'Mortgage'
  | 'Pets'
  | 'Rent'
  | 'Services'
  | 'Cleaning'
  | 'Electricity'
  | 'Heat'
  | 'Trash'
  | 'TV'
  | 'Phone/Internet'
  | 'Water'
  // Life (§12)
  | 'Child Care'
  | 'Clothing'
  | 'Education'
  | 'Gift'
  | 'Insurance'
  | 'Medical Expenses'
  | 'Taxes'
  // Transport (§12)
  | 'Bicycle'
  | 'Bus/Train'
  | 'Car'
  | 'Gas/Fuel'
  | 'Hotel'
  | 'Parking'
  | 'Plane'
  | 'Taxi'
  // Electronics (§12)
  | 'Other Electronics';

// Keyword-to-category map from spec §11.
// Each entry pairs a keyword list with the category it signals.
// Matching is case-insensitive substring — the first match wins.
const KEYWORD_MAP: ReadonlyArray<[keywords: readonly string[], category: Category]> = [
  [['taxi', 'uber', 'lyft', 'bolt', 'cab'], 'Taxi'],
  [['hotel', 'hostel', 'airbnb', 'accommodation', 'motel'], 'Hotel'],
  [['flight', 'plane', 'airline', 'airport'], 'Plane'],
  [['bus', 'tram', 'train', 'metro', 'subway'], 'Bus/Train'],
  [['gas', 'fuel', 'petrol', 'diesel'], 'Gas/Fuel'],
  [['parking'], 'Parking'],
  [['dinner', 'lunch', 'breakfast', 'restaurant', 'cafe', 'bar', 'bistro', 'konoba', 'taverna'], 'Dining Out'],
  [['grocery', 'groceries', 'supermarket', 'market', 'lidl', 'spar', 'kaufland'], 'Groceries'],
  [['beer', 'wine', 'spirits', 'drinks', 'liquor', 'alcohol', 'cocktail'], 'Liquor'],
  [['ticket', 'cinema', 'movie', 'concert', 'game', 'museum'], 'Movies / Games'],
  [['rent'], 'Rent'],
  [['electricity', 'electric', 'power bill'], 'Electricity'],
  [['phone', 'internet', 'wifi'], 'Phone/Internet'],
  [['insurance'], 'Insurance'],
  [['gift', 'present'], 'Gift'],
  [['medicine', 'pharmacy', 'doctor', 'hospital'], 'Medical Expenses'],
];

export function detectCategory(title: string): Category | null {
  const normalized = title.toLowerCase();
  for (const [keywords, category] of KEYWORD_MAP) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return category;
      }
    }
  }
  return null;
}
