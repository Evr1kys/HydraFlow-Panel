import { Injectable } from '@nestjs/common';

export type BotState =
  | { kind: 'idle' }
  | { kind: 'await_promo'; planId: string; provider: string }
  | { kind: 'await_topup_amount'; provider: string }
  | { kind: 'await_ticket_subject' }
  | { kind: 'await_ticket_message'; ticketId: string }
  | { kind: 'await_broadcast_text'; adminId: number };

/**
 * In-memory user state for multi-step conversations.
 * For production with multiple backend instances, replace with Redis.
 */
@Injectable()
export class BotStateService {
  private states = new Map<number, BotState>();

  get(telegramId: number): BotState {
    return this.states.get(telegramId) ?? { kind: 'idle' };
  }

  set(telegramId: number, state: BotState): void {
    this.states.set(telegramId, state);
  }

  clear(telegramId: number): void {
    this.states.delete(telegramId);
  }
}
