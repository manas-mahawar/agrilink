// Reference data. Must match the rows seeded in supabase/migrations/20261021000300_catalog.sql
// (a database test checks they are identical).
import type { Category, Locality } from '@/server/data/types';

export const CATEGORIES: Category[] = [
  { id: 'tomatoes', name: 'Tomatoes' },
  { id: 'potatoes', name: 'Potatoes' },
  { id: 'onions', name: 'Onions' },
  { id: 'other-vegetables', name: 'Other vegetables' },
  { id: 'fruits', name: 'Fruits' },
  { id: 'grains-pulses', name: 'Grains & pulses' },
];

export const LOCALITIES: Locality[] = [
  { id: 'patiala', name: 'Patiala', district: 'Patiala', kmFromPatiala: 0 },
  { id: 'sanaur', name: 'Sanaur', district: 'Patiala', kmFromPatiala: 7 },
  { id: 'bahadurgarh', name: 'Bahadurgarh', district: 'Patiala', kmFromPatiala: 8 },
  { id: 'dudhan-sadhan', name: 'Dudhan Sadhan', district: 'Patiala', kmFromPatiala: 22 },
  { id: 'rajpura', name: 'Rajpura', district: 'Patiala', kmFromPatiala: 27 },
  { id: 'nabha', name: 'Nabha', district: 'Patiala', kmFromPatiala: 27 },
  { id: 'samana', name: 'Samana', district: 'Patiala', kmFromPatiala: 28 },
  { id: 'ghanaur', name: 'Ghanaur', district: 'Patiala', kmFromPatiala: 30 },
  { id: 'bhadson', name: 'Bhadson', district: 'Patiala', kmFromPatiala: 35 },
  { id: 'patran', name: 'Patran', district: 'Patiala', kmFromPatiala: 50 },
  { id: 'shutrana', name: 'Shutrana', district: 'Patiala', kmFromPatiala: 60 },
];

export const categoryName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;
export const localityById = (id: string) => LOCALITIES.find((l) => l.id === id);

export const DISTANCE_OPTIONS = [10, 30, 60] as const;
export const HARVEST_WINDOW_OPTIONS = [
  { days: 14, label: 'Within 2 weeks' },
  { days: 30, label: 'Within 30 days' },
  { days: 60, label: 'Within 60 days' },
] as const;
