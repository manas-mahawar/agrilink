// ILLUSTRATIVE DEMO DATA — every person, business, listing and price below is invented for
// demonstrations. It is used in two places only:
//   1. scripts/seed-demo.ts seeds it into a *demo* Supabase project (rows flagged is_demo).
//   2. The read-only preview shown when no Supabase project is configured yet.
// It must never be seeded into the production project (the seed script refuses unless told
// explicitly that the target is a demo project).
import type { ProduceImageKey } from './images';
import type { AvailabilityType, QualityGrade } from '@/domain/listings';
import type { Unit } from '@/domain/units';

export interface DemoFarmer {
  id: string;
  key: string;
  displayName: string;
  localityId: string;
  district: string;
  village: string;
  bio: string;
  verified: boolean;
  joinedDaysAgo: number;
}
export interface DemoBuyer {
  id: string;
  key: string;
  displayName: string;
  organisationName: string;
  buyerType: 'retailer' | 'restaurant' | 'hotel' | 'wholesaler' | 'processor';
  district: string;
}
export interface DemoListing {
  id: string;
  farmerKey: string;
  categoryId: 'tomatoes' | 'potatoes' | 'onions';
  produceName: string;
  variety: string;
  localityId: string;
  unit: Unit;
  quantityTotal: number;
  minOrderQty: number;
  maxOrderQty: number | null;
  pricePerUnitPaise: number;
  availabilityType: AvailabilityType;
  harvestInDays: number | null;
  availableForDays: number | null;
  qualityGrade: QualityGrade;
  qualityNotes: string;
  description: string;
  images: ProduceImageKey[];
  publishedDaysAgo: number;
}

const farmerId = (n: number) => `00000000-0000-4000-8000-0000000f${String(n).padStart(4, '0')}`;
const buyerId = (n: number) => `00000000-0000-4000-8000-0000000b${String(n).padStart(4, '0')}`;
const listingId = (n: number) => `00000000-0000-4000-8000-0000000c${String(n).padStart(4, '0')}`;

export const DEMO_FARMERS: DemoFarmer[] = [
  { id: farmerId(1), key: 'gurpreet', displayName: 'Gurpreet Singh', localityId: 'sanaur', district: 'Patiala', village: 'Sanaur', verified: true, joinedDaysAgo: 64,
    bio: 'Grows tomatoes, potatoes and onions on family land near Sanaur. Drip irrigation on the tomato beds.' },
  { id: farmerId(2), key: 'harjinder', displayName: 'Harjinder Kaur', localityId: 'rajpura', district: 'Patiala', village: 'Rajpura', verified: true, joinedDaysAgo: 51,
    bio: 'Vegetable grower near Rajpura. Picks tomatoes every four to five days once harvest starts.' },
  { id: farmerId(3), key: 'balwinder', displayName: 'Balwinder Singh', localityId: 'nabha', district: 'Patiala', village: 'Nabha', verified: true, joinedDaysAgo: 47,
    bio: 'Potato farmer near Nabha, mostly table varieties.' },
  { id: farmerId(4), key: 'manpreet', displayName: 'Manpreet Kaur', localityId: 'samana', district: 'Patiala', village: 'Samana', verified: true, joinedDaysAgo: 40,
    bio: 'Kharif onions, field-cured before dispatch.' },
  { id: farmerId(5), key: 'sukhdev', displayName: 'Sukhdev Singh', localityId: 'patran', district: 'Patiala', village: 'Patran', verified: false, joinedDaysAgo: 9,
    bio: 'New to AgriLink. Onions and tomatoes.' },
  { id: farmerId(6), key: 'paramjit', displayName: 'Paramjit Kaur', localityId: 'ghanaur', district: 'Patiala', village: 'Ghanaur', verified: true, joinedDaysAgo: 33,
    bio: 'Grows firm, oval tomatoes that suit restaurants and processing.' },
  { id: farmerId(7), key: 'jaswant', displayName: 'Jaswant Singh', localityId: 'bahadurgarh', district: 'Patiala', village: 'Bahadurgarh', verified: true, joinedDaysAgo: 28,
    bio: 'Close to Patiala city — easy farm-gate pickup.' },
];

export const DEMO_BUYERS: DemoBuyer[] = [
  { id: buyerId(1), key: 'sidhu', displayName: 'Harleen Sidhu', organisationName: 'Sidhu Veg Mart', buyerType: 'retailer', district: 'Patiala' },
  { id: buyerId(2), key: 'greenplate', displayName: 'Rohit Bansal', organisationName: 'Green Plate Kitchen', buyerType: 'restaurant', district: 'Patiala' },
  { id: buyerId(3), key: 'garg', displayName: 'Amandeep Garg', organisationName: 'Garg Wholesale Traders', buyerType: 'wholesaler', district: 'Rajpura' },
  { id: buyerId(4), key: 'kesar', displayName: 'Neha Arora', organisationName: 'Kesar Agro Processing', buyerType: 'processor', district: 'Rajpura' },
];

// Prices are per quintal (₹1,600 per quintal = ₹16 per kg), stored in paise.
export const DEMO_LISTINGS: DemoListing[] = [
  { id: listingId(1), farmerKey: 'gurpreet', categoryId: 'tomatoes', produceName: 'Tomato', variety: 'Punjab Ratta', localityId: 'sanaur',
    unit: 'quintal', quantityTotal: 120, minOrderQty: 10, maxOrderQty: 120, pricePerUnitPaise: 160000, availabilityType: 'pre_harvest',
    harvestInDays: 29, availableForDays: 21, qualityGrade: 'grade_a', qualityNotes: 'Sorted at the farm; 25 kg crates on request.',
    description: 'Staked crop on drip irrigation. First picking expected in the harvest week, then every few days.',
    images: ['tomatoHeap', 'tomatoPlantsField', 'tomatoVineCloseup'], publishedDaysAgo: 6 },
  { id: listingId(2), farmerKey: 'harjinder', categoryId: 'tomatoes', produceName: 'Tomato', variety: 'Hybrid', localityId: 'rajpura',
    unit: 'quintal', quantityTotal: 80, minOrderQty: 5, maxOrderQty: 60, pricePerUnitPaise: 155000, availabilityType: 'pre_harvest',
    harvestInDays: 36, availableForDays: 28, qualityGrade: 'grade_a', qualityNotes: 'Uniform size, picked half-ripe for transport.',
    description: 'Pickings every 4–5 days after the first harvest. Prefers buyers who can take weekly lots.',
    images: ['tomatoRipeStems', 'tomatoRipeningPlant', 'tomatoOnVine'], publishedDaysAgo: 5 },
  { id: listingId(3), farmerKey: 'balwinder', categoryId: 'potatoes', produceName: 'Potato', variety: 'Kufri Pukhraj', localityId: 'nabha',
    unit: 'quintal', quantityTotal: 300, minOrderQty: 25, maxOrderQty: 300, pricePerUnitPaise: 100000, availabilityType: 'pre_harvest',
    harvestInDays: 51, availableForDays: 30, qualityGrade: 'grade_a', qualityNotes: 'Table potato, cured for two weeks after haulm cutting.',
    description: 'The crop can wait in the field for around 10 days after the expected date if a buyer needs it to.',
    images: ['potatoHarvestedSoil', 'potatoLifting', 'potatoUnwashed'], publishedDaysAgo: 8 },
  { id: listingId(4), farmerKey: 'gurpreet', categoryId: 'potatoes', produceName: 'Potato', variety: 'Kufri Jyoti', localityId: 'sanaur',
    unit: 'quintal', quantityTotal: 200, minOrderQty: 20, maxOrderQty: 150, pricePerUnitPaise: 95000, availabilityType: 'pre_harvest',
    harvestInDays: 61, availableForDays: 30, qualityGrade: 'grade_b', qualityNotes: 'Mixed sizes; grading can be arranged at an agreed cost.',
    description: 'Not graded at source.', images: ['potatoMixedSizes', 'potatoPlantsSpade', 'potatoCloseup'], publishedDaysAgo: 3 },
  { id: listingId(5), farmerKey: 'manpreet', categoryId: 'onions', produceName: 'Onion', variety: 'Agrifound Dark Red', localityId: 'samana',
    unit: 'quintal', quantityTotal: 150, minOrderQty: 10, maxOrderQty: 150, pricePerUnitPaise: 210000, availabilityType: 'pre_harvest',
    harvestInDays: 19, availableForDays: 30, qualityGrade: 'grade_a', qualityNotes: 'Field-cured 7–10 days; 50 kg mesh bags.',
    description: 'Kharif onion. Dispatch after curing.', images: ['onionRedHeap', 'onionSeedlings', 'onionRedCloseup'], publishedDaysAgo: 10 },
  { id: listingId(6), farmerKey: 'sukhdev', categoryId: 'onions', produceName: 'Onion', variety: 'Punjab Naroya', localityId: 'patran',
    unit: 'quintal', quantityTotal: 90, minOrderQty: 10, maxOrderQty: 90, pricePerUnitPaise: 195000, availabilityType: 'pre_harvest',
    harvestInDays: 41, availableForDays: 30, qualityGrade: 'grade_b', qualityNotes: 'Medium bulbs.',
    description: 'Farmer is new to AgriLink and not yet verified.', images: ['onionRedBrown', 'onionSingle', 'onionBowls'], publishedDaysAgo: 2 },
  { id: listingId(7), farmerKey: 'gurpreet', categoryId: 'onions', produceName: 'Onion', variety: 'Agrifound Dark Red', localityId: 'sanaur',
    unit: 'quintal', quantityTotal: 60, minOrderQty: 5, maxOrderQty: 60, pricePerUnitPaise: 200000, availabilityType: 'ready_now',
    harvestInDays: null, availableForDays: 14, qualityGrade: 'grade_a', qualityNotes: 'Cured and bagged; lots can be dispatched in stages.',
    description: 'Harvest has started. Bulbs are being cured.', images: ['onionCrate', 'onionSeedlings', 'onionRedCloseup'], publishedDaysAgo: 21 },
  { id: listingId(8), farmerKey: 'paramjit', categoryId: 'tomatoes', produceName: 'Tomato', variety: 'Punjab Chhuhara', localityId: 'ghanaur',
    unit: 'quintal', quantityTotal: 50, minOrderQty: 5, maxOrderQty: 50, pricePerUnitPaise: 170000, availabilityType: 'pre_harvest',
    harvestInDays: 23, availableForDays: 21, qualityGrade: 'grade_a', qualityNotes: 'Oval, firm fruit.',
    description: 'Suits restaurants and processing.', images: ['tomatoCrate', 'tomatoClusterVine', 'tomatoHeapRed'], publishedDaysAgo: 4 },
  { id: listingId(9), farmerKey: 'jaswant', categoryId: 'potatoes', produceName: 'Potato', variety: 'Kufri Pukhraj', localityId: 'bahadurgarh',
    unit: 'quintal', quantityTotal: 140, minOrderQty: 10, maxOrderQty: 100, pricePerUnitPaise: 110000, availabilityType: 'pre_harvest',
    harvestInDays: 43, availableForDays: 30, qualityGrade: 'grade_a', qualityNotes: 'Washed on request.',
    description: 'Close to Patiala city — easy farm-gate pickup for local buyers.', images: ['potatoMarketLot', 'potatoHands', 'potatoYellowPile'], publishedDaysAgo: 7 },
  { id: listingId(10), farmerKey: 'sukhdev', categoryId: 'tomatoes', produceName: 'Tomato', variety: 'Hybrid', localityId: 'patran',
    unit: 'quintal', quantityTotal: 70, minOrderQty: 10, maxOrderQty: 70, pricePerUnitPaise: 145000, availabilityType: 'pre_harvest',
    harvestInDays: 46, availableForDays: 21, qualityGrade: 'ungraded', qualityNotes: 'Field run.',
    description: 'Sold ungraded.', images: ['tomatoMixedRipeness', 'tomatoTurningRed', 'tomatoRoundCloseup'], publishedDaysAgo: 1 },
];

/** Sample negotiation activity the seed script creates by calling the real database functions. */
export const DEMO_ACTIVITY = {
  offers: [
    { key: 'o1', listing: 1, buyer: 'greenplate', quantity: 20, pricePerUnitPaise: 150000, fulfilment: 'farmer_delivery', message: 'Weekly lots of about 5 quintals would suit us.' },
    { key: 'o2', listing: 1, buyer: 'garg', quantity: 60, pricePerUnitPaise: 145000, fulfilment: 'buyer_pickup', message: 'We can collect from the farm gate with our own vehicle.' },
    { key: 'o3', listing: 4, buyer: 'sidhu', quantity: 30, pricePerUnitPaise: 90000, fulfilment: 'buyer_pickup', counter: { by: 'farmer', pricePerUnitPaise: 97500 } },
    { key: 'o4', listing: 7, buyer: 'sidhu', quantity: 25, pricePerUnitPaise: 200000, fulfilment: 'buyer_pickup', accept: 'farmer', orderSteps: ['confirm'] },
    { key: 'o5', listing: 7, buyer: 'kesar', quantity: 15, pricePerUnitPaise: 190000, fulfilment: 'logistics_partner', counter: { by: 'farmer', pricePerUnitPaise: 195000 }, accept: 'buyer', orderSteps: ['confirm', 'start_preparing', 'mark_ready', 'complete'], review: { rating: 4, comment: 'Bulbs as described and well cured. (Demo review)' } },
    { key: 'o6', listing: 5, buyer: 'sidhu', quantity: 40, pricePerUnitPaise: 200000, fulfilment: 'farmer_delivery', message: 'Weekly delivery to our Patiala shop preferred.' },
  ],
} as const;

export const demoFarmerByKey = (key: string) => DEMO_FARMERS.find((f) => f.key === key)!;
