// Bundled photography (re-cut from the Unsplash photos used in the design reference).
// Every image is illustrative; nothing here shows a real AgriLink farmer or transaction.

export interface SiteImage {
  src: string;
  alt: string;
  width: number;
  height: number;
}

const crop = (name: string, alt: string): SiteImage => ({ src: `/images/produce/${name}.webp`, alt, width: 1200, height: 900 });
const scene = (name: string, alt: string, width = 1500, height = 1000): SiteImage => ({
  src: `/images/scenes/${name}.webp`,
  alt,
  width,
  height,
});

export const PRODUCE = {
  tomatoHeap: crop('tomato-heap', 'A pile of ripe red tomatoes'),
  tomatoPlantsField: crop('tomato-plants-field', 'Tomato plants with ripening fruit in a field'),
  tomatoVineCloseup: crop('tomato-vine-closeup', 'Red tomatoes on the vine, close up'),
  tomatoRipeStems: crop('tomato-ripe-stems', 'Ripe red tomatoes with green stems'),
  tomatoRipeningPlant: crop('tomato-ripening-plant', 'Tomatoes ripening on the plant'),
  tomatoOnVine: crop('tomato-on-vine', 'Fresh red tomatoes still on the vine'),
  tomatoCrate: crop('tomato-crate', 'A crate of small red tomatoes'),
  tomatoClusterVine: crop('tomato-cluster-vine', 'A cluster of tomatoes ripening on the vine'),
  tomatoHeapRed: crop('tomato-heap-red', 'A heap of red tomatoes'),
  tomatoMixedRipeness: crop('tomato-mixed-ripeness', 'Tomatoes at mixed stages of ripeness'),
  tomatoTurningRed: crop('tomato-turning-red', 'Tomatoes turning from green to red on the plant'),
  tomatoRoundCloseup: crop('tomato-round-closeup', 'Round red tomatoes, close up'),
  potatoHarvestedSoil: crop('potato-harvested-soil', 'Freshly harvested potatoes with soil on their skins'),
  potatoLifting: crop('potato-lifting', 'Potatoes being lifted from the soil with their roots'),
  potatoUnwashed: crop('potato-unwashed', 'Unwashed potatoes after harvest'),
  potatoMixedSizes: crop('potato-mixed-sizes', 'Mixed-size potatoes lying on the soil after digging'),
  potatoPlantsSpade: crop('potato-plants-spade', 'Potato plants in the field with a spade'),
  potatoCloseup: crop('potato-closeup', 'Brown potatoes, close up'),
  potatoMarketLot: crop('potato-market-lot', 'A large lot of potatoes at a market'),
  potatoHands: crop('potato-hands', 'Hands holding freshly dug potatoes'),
  potatoYellowPile: crop('potato-yellow-pile', 'A pile of yellow potatoes'),
  potatoBrownPile: crop('potato-brown-pile', 'A pile of brown potatoes'),
  onionRedHeap: crop('onion-red-heap', 'A heap of red onions'),
  onionSeedlings: crop('onion-seedlings', 'Onion seedlings being planted in the soil'),
  onionRedCloseup: crop('onion-red-closeup', 'Red onions, close up'),
  onionRedBrown: crop('onion-red-brown', 'Red and brown onions piled together'),
  onionSingle: crop('onion-single', 'A single red onion'),
  onionBowls: crop('onion-bowls', 'Red onions in wooden bowls'),
  onionCrate: crop('onion-crate', 'A crate of red onions'),
} as const;

export const SCENES = {
  farmerWheatHarvest: scene('farmer-wheat-harvest', 'A farmer gathering wheat by hand while a combine harvester works behind him', 2000, 1125),
  farmerPaddyWalk: scene('farmer-paddy-walk', 'A farmer walking along the edge of a bright green paddy field', 2000, 1125),
  combineWheatField: scene('combine-wheat-field', 'A combine harvester working a golden wheat field', 2000, 1125),
  greenFieldRows: scene('green-field-rows', 'Rows of green crops in a flat farm field', 2000, 1125),
  womenFarmersField: scene('women-farmers-field', 'Women farmers working together in a vegetable field'),
  marketChilliesBuyer: scene('market-chillies-buyer', 'A buyer choosing fresh green chillies at an Indian vegetable market'),
  vegetableMarketStreet: scene('vegetable-market-street', 'A crowded wholesale vegetable market street in India'),
  tractorTrolleyField: scene('tractor-trolley-field', 'A tractor pulling a loaded trolley out of a harvested field'),
  marketStallVegetables: scene('market-stall-vegetables', 'Fresh tomatoes, cabbages and gourds stacked at a market stall'),
  farmerHoePaddy: scene('farmer-hoe-paddy', 'A farmer resting on his hoe beside rice paddies'),
  womenFarmersLeafy: scene('women-farmers-leafy', 'Women farmers tending a leafy vegetable crop'),
  potatoSacksTransport: scene('potato-sacks-transport', 'Mesh sacks of potatoes tied and stacked for transport'),
  womanFarmerCrop: scene('woman-farmer-crop', 'A woman farmer holding freshly cut crop in a field', 1050, 1400),
  farmerTractorField: scene('farmer-tractor-field', 'A farmer driving a tractor across a field', 1050, 1400),
  fieldHorizonBanner: scene('field-horizon-banner', '', 1800, 600),
  produceDisplayBanner: scene('produce-display-banner', '', 1800, 600),
} as const;

export type ProduceImageKey = keyof typeof PRODUCE;

/**
 * Fallback photos for a category when a listing has no uploaded images. Only crops we have
 * genuine photos for; other categories show a neutral "photo pending" placeholder instead
 * of an unrelated picture.
 */
export const CATEGORY_FALLBACK: Partial<Record<string, ProduceImageKey[]>> = {
  tomatoes: ['tomatoOnVine', 'tomatoPlantsField', 'tomatoVineCloseup'],
  potatoes: ['potatoBrownPile', 'potatoLifting', 'potatoCloseup'],
  onions: ['onionRedCloseup', 'onionSeedlings', 'onionSingle'],
};

export const BRAND = {
  logo: { src: '/brand/agrilink-logo.png', width: 486, height: 144 },
  logoFull: { src: '/brand/agrilink-logo-full.png', width: 1200, height: 369 },
  mark: { src: '/brand/agrilink-mark.png', width: 269, height: 256 },
} as const;
