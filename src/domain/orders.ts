// Order state machine — mirrors public.transition_order() in
// supabase/migrations/20261021000500_offers_orders.sql. A database test checks every
// (status, action, actor) combination against this table, so the two cannot drift apart.

export const ORDER_STATUSES = ['awaiting_confirmation', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type OrderActor = 'buyer' | 'farmer' | 'admin';
export type OrderAction = 'confirm' | 'start_preparing' | 'mark_ready' | 'complete' | 'cancel';
export const ORDER_ACTIONS: readonly OrderAction[] = ['confirm', 'start_preparing', 'mark_ready', 'complete', 'cancel'];

interface Transition {
  action: OrderAction;
  actors: readonly OrderActor[];
  from: readonly OrderStatus[];
  to: OrderStatus;
}

export const ORDER_TRANSITIONS: readonly Transition[] = [
  { action: 'confirm', actors: ['farmer'], from: ['awaiting_confirmation'], to: 'confirmed' },
  { action: 'start_preparing', actors: ['farmer'], from: ['confirmed'], to: 'preparing' },
  { action: 'mark_ready', actors: ['farmer'], from: ['preparing'], to: 'ready' },
  { action: 'complete', actors: ['buyer'], from: ['ready'], to: 'completed' },
  { action: 'cancel', actors: ['buyer', 'farmer'], from: ['awaiting_confirmation', 'confirmed', 'preparing'], to: 'cancelled' },
  { action: 'cancel', actors: ['admin'], from: ['awaiting_confirmation', 'confirmed', 'preparing', 'ready'], to: 'cancelled' },
];

export function nextOrderStatus(status: OrderStatus, action: OrderAction, actor: OrderActor): OrderStatus | null {
  const t = ORDER_TRANSITIONS.find((x) => x.action === action && x.actors.includes(actor) && x.from.includes(status));
  return t ? t.to : null;
}

export function allowedOrderActions(status: OrderStatus, actor: OrderActor): OrderAction[] {
  return ORDER_ACTIONS.filter((a) => nextOrderStatus(status, a, actor) !== null);
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_confirmation: 'Awaiting confirmation',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for pickup or dispatch',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const ORDER_ACTION_LABEL: Record<OrderAction, string> = {
  confirm: 'Confirm order',
  start_preparing: 'Start preparing',
  mark_ready: 'Mark ready',
  complete: 'Confirm receipt',
  cancel: 'Cancel order',
};

/** Steps shown in the order tracker, in order. */
export const ORDER_PROGRESS: readonly OrderStatus[] = ['awaiting_confirmation', 'confirmed', 'preparing', 'ready', 'completed'];

export function orderProgressIndex(status: OrderStatus): number {
  return ORDER_PROGRESS.indexOf(status);
}

export const FULFILMENT_METHODS = ['buyer_pickup', 'farmer_delivery', 'logistics_partner'] as const;
export type FulfilmentMethod = (typeof FULFILMENT_METHODS)[number];
export const FULFILMENT_LABEL: Record<FulfilmentMethod, string> = {
  buyer_pickup: 'Buyer collects from the farm',
  farmer_delivery: 'Farmer delivers',
  logistics_partner: 'Arrange through a local transporter',
};

export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  not_started: 'Settled directly between buyer and farmer',
  pending: 'Payment pending',
  paid: 'Paid (verified)',
  failed: 'Payment failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
};
