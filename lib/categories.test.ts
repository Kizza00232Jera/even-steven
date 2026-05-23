import { detectCategory, type Category } from './categories';

describe('detectCategory', () => {
  describe('Transport keywords (§11)', () => {
    it.each(['taxi', 'uber', 'lyft', 'bolt', 'cab'])(
      'matches "%s" to Taxi',
      (keyword) => {
        expect(detectCategory(keyword)).toBe('Taxi');
      }
    );

    it.each(['hotel', 'hostel', 'airbnb', 'accommodation', 'motel'])(
      'matches "%s" to Hotel',
      (keyword) => {
        expect(detectCategory(keyword)).toBe('Hotel');
      }
    );

    it.each(['flight', 'plane', 'airline', 'airport'])(
      'matches "%s" to Plane',
      (keyword) => {
        expect(detectCategory(keyword)).toBe('Plane');
      }
    );

    it.each(['bus', 'tram', 'train', 'metro', 'subway'])(
      'matches "%s" to Bus/Train',
      (keyword) => {
        expect(detectCategory(keyword)).toBe('Bus/Train');
      }
    );

    it.each(['gas', 'fuel', 'petrol', 'diesel'])(
      'matches "%s" to Gas/Fuel',
      (keyword) => {
        expect(detectCategory(keyword)).toBe('Gas/Fuel');
      }
    );

    it('matches "parking" to Parking', () => {
      expect(detectCategory('parking')).toBe('Parking');
    });
  });

  describe('Food & Drink keywords (§11)', () => {
    it.each(['dinner', 'lunch', 'breakfast', 'restaurant', 'cafe', 'bar', 'bistro', 'konoba', 'taverna'])(
      'matches "%s" to Dining Out',
      (keyword) => {
        expect(detectCategory(keyword)).toBe('Dining Out');
      }
    );

    it.each(['grocery', 'groceries', 'supermarket', 'market', 'lidl', 'spar', 'kaufland'])(
      'matches "%s" to Groceries',
      (keyword) => {
        expect(detectCategory(keyword)).toBe('Groceries');
      }
    );

    it.each(['beer', 'wine', 'spirits', 'drinks', 'liquor', 'alcohol', 'cocktail'])(
      'matches "%s" to Liquor',
      (keyword) => {
        expect(detectCategory(keyword)).toBe('Liquor');
      }
    );
  });

  describe('Entertainment keywords (§11)', () => {
    it.each(['ticket', 'cinema', 'movie', 'concert', 'game', 'museum'])(
      'matches "%s" to Movies / Games',
      (keyword) => {
        expect(detectCategory(keyword)).toBe('Movies / Games');
      }
    );
  });

  describe('Home keywords (§11)', () => {
    it('matches "rent" to Rent', () => {
      expect(detectCategory('rent')).toBe('Rent');
    });

    it.each(['electricity', 'electric', 'power bill'])(
      'matches "%s" to Electricity',
      (keyword) => {
        expect(detectCategory(keyword)).toBe('Electricity');
      }
    );

    it.each(['phone', 'internet', 'wifi'])(
      'matches "%s" to Phone/Internet',
      (keyword) => {
        expect(detectCategory(keyword)).toBe('Phone/Internet');
      }
    );
  });

  describe('Life keywords (§11)', () => {
    it('matches "insurance" to Insurance', () => {
      expect(detectCategory('insurance')).toBe('Insurance');
    });

    it.each(['gift', 'present'])(
      'matches "%s" to Gift',
      (keyword) => {
        expect(detectCategory(keyword)).toBe('Gift');
      }
    );

    it.each(['medicine', 'pharmacy', 'doctor', 'hospital'])(
      'matches "%s" to Medical Expenses',
      (keyword) => {
        expect(detectCategory(keyword)).toBe('Medical Expenses');
      }
    );
  });

  describe('case insensitivity', () => {
    it('matches uppercase keyword', () => {
      expect(detectCategory('UBER')).toBe('Taxi');
    });

    it('matches mixed-case keyword', () => {
      expect(detectCategory('Airbnb')).toBe('Hotel');
    });

    it('matches title-case keyword', () => {
      expect(detectCategory('Restaurant')).toBe('Dining Out');
    });
  });

  describe('partial substring matching', () => {
    it('matches keyword embedded in a longer title', () => {
      expect(detectCategory('Uber Eats order')).toBe('Taxi');
    });

    it('matches keyword at the end of a title', () => {
      expect(detectCategory('Dinner at Konoba')).toBe('Dining Out');
    });

    it('matches keyword at the start of a title', () => {
      expect(detectCategory('Hotel Hilton checkout')).toBe('Hotel');
    });

    it('matches multi-word keyword "power bill"', () => {
      expect(detectCategory('Monthly power bill')).toBe('Electricity');
    });
  });

  describe('null for unrecognised input', () => {
    it('returns null for an empty string', () => {
      expect(detectCategory('')).toBeNull();
    });

    it('returns null for a title with no matching keywords', () => {
      expect(detectCategory('Random stuff')).toBeNull();
    });

    it('returns null for a whitespace-only string', () => {
      expect(detectCategory('   ')).toBeNull();
    });
  });

  describe('Category type covers all §11 categories', () => {
    const all11Categories: Category[] = [
      'Taxi',
      'Hotel',
      'Plane',
      'Bus/Train',
      'Gas/Fuel',
      'Parking',
      'Dining Out',
      'Groceries',
      'Liquor',
      'Movies / Games',
      'Rent',
      'Electricity',
      'Phone/Internet',
      'Insurance',
      'Gift',
      'Medical Expenses',
    ];

    it('all §11 categories are valid Category values (type-level check)', () => {
      expect(all11Categories).toHaveLength(16);
    });
  });
});
