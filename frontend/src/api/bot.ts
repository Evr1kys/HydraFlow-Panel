import { client } from './client';

export interface BotStats {
  users: { total: number; banned: number; newDay: number; newWeek: number };
  transactions: { day: number; week: number; month: number };
  revenue: { day: number; week: number; month: number };
  support: { openTickets: number };
}

export interface BotUserRow {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  languageCode: string;
  balance: string;
  totalSpent: string;
  banned: boolean;
  userId: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface BotPlan {
  id: string;
  name: string;
  daysDuration: number;
  trafficGb: number | null;
  price: string;
  currency: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface BotPromo {
  id: string;
  code: string;
  discountPercent: number | null;
  discountAmount: string | null;
  maxUses: number | null;
  usedCount: number;
  validFrom: string;
  validUntil: string | null;
  enabled: boolean;
  createdAt: string;
}

export interface BotButton {
  id: string;
  menuType: string;
  buttonId: string;
  text: string;
  callbackData: string | null;
  url: string | null;
  rowPosition: number;
  columnPosition: number;
  buttonWidth: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BotTransaction {
  id: string;
  botUserId: string;
  type: string;
  amount: string;
  currency: string;
  provider: string;
  providerPaymentId: string | null;
  status: string;
  planId: string | null;
  promoCode: string | null;
  createdAt: string;
  completedAt: string | null;
}

export async function getBotStats(): Promise<BotStats> {
  const { data } = await client.get<BotStats>('/bot/stats');
  return data;
}

export async function getBotUsers(params?: {
  search?: string;
  start?: number;
  size?: number;
}): Promise<{ items: BotUserRow[]; total: number }> {
  const { data } = await client.get<{ items: BotUserRow[]; total: number }>('/bot/users', {
    params,
  });
  return data;
}

export async function updateBotUser(
  id: string,
  body: { banned?: boolean; balance?: number },
): Promise<BotUserRow> {
  const { data } = await client.patch<BotUserRow>(`/bot/users/${id}`, body);
  return data;
}

export async function listBotPlans(): Promise<BotPlan[]> {
  const { data } = await client.get<BotPlan[]>('/bot/plans');
  return data;
}

export async function createBotPlan(body: Partial<BotPlan>): Promise<BotPlan> {
  const { data } = await client.post<BotPlan>('/bot/plans', body);
  return data;
}

export async function updateBotPlan(id: string, body: Partial<BotPlan>): Promise<BotPlan> {
  const { data } = await client.patch<BotPlan>(`/bot/plans/${id}`, body);
  return data;
}

export async function deleteBotPlan(id: string): Promise<void> {
  await client.delete(`/bot/plans/${id}`);
}

export async function listBotPromos(): Promise<BotPromo[]> {
  const { data } = await client.get<BotPromo[]>('/bot/promos');
  return data;
}

export async function createBotPromo(body: Partial<BotPromo>): Promise<BotPromo> {
  const { data } = await client.post<BotPromo>('/bot/promos', body);
  return data;
}

export async function deleteBotPromo(id: string): Promise<void> {
  await client.delete(`/bot/promos/${id}`);
}

export async function listBotButtons(menuType?: string): Promise<BotButton[]> {
  const { data } = await client.get<BotButton[]>('/bot/buttons', {
    params: menuType ? { menu_type: menuType } : {},
  });
  return data;
}

export async function createBotButton(body: Partial<BotButton>): Promise<BotButton> {
  const { data } = await client.post<BotButton>('/bot/buttons', body);
  return data;
}

export async function updateBotButton(
  id: string,
  body: Partial<BotButton>,
): Promise<BotButton> {
  const { data } = await client.patch<BotButton>(`/bot/buttons/${id}`, body);
  return data;
}

export async function deleteBotButton(id: string): Promise<void> {
  await client.delete(`/bot/buttons/${id}`);
}

export async function reorderBotButtons(
  items: Array<{
    id: string;
    rowPosition: number;
    columnPosition: number;
    sortOrder: number;
    buttonWidth?: number;
  }>,
): Promise<void> {
  await client.post('/bot/buttons/reorder', { items });
}

export async function listBotTransactions(params?: {
  userId?: string;
  status?: string;
  from?: string;
  to?: string;
  start?: number;
  size?: number;
}): Promise<{ items: BotTransaction[]; total: number }> {
  const { data } = await client.get<{ items: BotTransaction[]; total: number }>(
    '/bot/transactions',
    { params },
  );
  return data;
}

export async function sendBotBroadcast(text: string): Promise<{ sent: number; failed: number }> {
  const { data } = await client.post<{ sent: number; failed: number }>('/bot/broadcast', {
    text,
  });
  return data;
}

export interface BotMenuConfig {
  menuType: string;
  keyboardMode: 'inline' | 'reply';
  resize: boolean;
  oneTime: boolean;
  title: string | null;
  updatedAt: string;
}

export async function listBotMenus(): Promise<BotMenuConfig[]> {
  const { data } = await client.get<BotMenuConfig[]>('/bot/menus');
  return data;
}

export async function getBotMenu(menuType: string): Promise<BotMenuConfig> {
  const { data } = await client.get<BotMenuConfig>(`/bot/menus/${menuType}`);
  return data;
}

export async function updateBotMenu(
  menuType: string,
  body: Partial<Pick<BotMenuConfig, 'keyboardMode' | 'resize' | 'oneTime' | 'title'>>,
): Promise<BotMenuConfig> {
  const { data } = await client.patch<BotMenuConfig>(`/bot/menus/${menuType}`, body);
  return data;
}

export async function giveSubscription(body: {
  telegramId: string;
  days: number;
  trafficGb?: number | null;
}): Promise<{ userId: string; email: string; expiryDate: string; isNew: boolean }> {
  const { data } = await client.post<{
    userId: string;
    email: string;
    expiryDate: string;
    isNew: boolean;
  }>('/bot/give-subscription', body);
  return data;
}
