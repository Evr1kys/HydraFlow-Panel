import { Injectable } from '@nestjs/common';
import { InlineKeyboard, Keyboard } from 'grammy';
import type { BotButton } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface KeyboardOptions {
  /** Text substitutions, e.g. { '{count}': '3' } */
  textReplacements?: Record<string, string>;
  /** Filter callback — return true to include the button */
  filter?: (btn: BotButton) => boolean;
}

export type BuiltKeyboard =
  | { mode: 'inline'; markup: InlineKeyboard }
  | { mode: 'reply'; markup: Keyboard; resize: boolean; oneTime: boolean };

@Injectable()
export class KeyboardBuilder {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build an InlineKeyboard for the given menu type (backward-compatible).
   * Returns null if no buttons configured.
   */
  async build(
    menuType: string,
    opts: KeyboardOptions = {},
  ): Promise<InlineKeyboard | null> {
    const buttons = await this.loadButtons(menuType, opts);
    if (buttons.length === 0) return null;
    return this.buildInlineFromButtons(buttons, opts);
  }

  /**
   * Build a keyboard honoring the menu's configured mode
   * (inline or reply, from BotMenuConfig).
   */
  async buildAuto(
    menuType: string,
    opts: KeyboardOptions = {},
  ): Promise<BuiltKeyboard | null> {
    const [buttons, menuConfig] = await Promise.all([
      this.loadButtons(menuType, opts),
      this.prisma.botMenuConfig.findUnique({ where: { menuType } }),
    ]);
    if (buttons.length === 0) return null;
    const mode = (menuConfig?.keyboardMode ?? 'inline') as 'inline' | 'reply';

    if (mode === 'reply') {
      const kb = new Keyboard();
      const rows = this.groupByRow(buttons);
      for (const rowButtons of rows) {
        for (const btn of rowButtons) {
          const text = this.applyReplacements(btn.text, opts.textReplacements);
          kb.text(text);
        }
        kb.row();
      }
      return {
        mode: 'reply',
        markup: kb,
        resize: menuConfig?.resize ?? true,
        oneTime: menuConfig?.oneTime ?? false,
      };
    }

    return { mode: 'inline', markup: this.buildInlineFromButtons(buttons, opts) };
  }

  private async loadButtons(
    menuType: string,
    opts: KeyboardOptions,
  ): Promise<BotButton[]> {
    const buttons = await this.prisma.botButton.findMany({
      where: { menuType, isActive: true },
      orderBy: [
        { rowPosition: 'asc' },
        { columnPosition: 'asc' },
        { sortOrder: 'asc' },
      ],
    });
    const seen = new Set<string>();
    const filtered: BotButton[] = [];
    for (const btn of buttons) {
      if (opts.filter && !opts.filter(btn)) continue;
      if (btn.buttonId) {
        const key = `${btn.menuType}:${btn.buttonId}`;
        if (seen.has(key)) continue;
        seen.add(key);
      }
      filtered.push(btn);
    }
    return filtered;
  }

  private groupByRow(buttons: BotButton[]): BotButton[][] {
    const rows = new Map<number, BotButton[]>();
    for (const btn of buttons) {
      const arr = rows.get(btn.rowPosition) ?? [];
      arr.push(btn);
      rows.set(btn.rowPosition, arr);
    }
    return [...rows.keys()]
      .sort((a, b) => a - b)
      .map((k) =>
        (rows.get(k) ?? []).sort(
          (a, b) =>
            a.columnPosition - b.columnPosition || a.sortOrder - b.sortOrder,
        ),
      );
  }

  private buildInlineFromButtons(
    buttons: BotButton[],
    opts: KeyboardOptions,
  ): InlineKeyboard {
    const kb = new InlineKeyboard();
    const rows = this.groupByRow(
      buttons.filter((b) => b.callbackData || b.url),
    );
    for (const rowButtons of rows) {
      let i = 0;
      while (i < rowButtons.length) {
        const btn = rowButtons[i];
        const width = Math.max(1, Math.min(btn.buttonWidth, 3));
        const text = this.applyReplacements(btn.text, opts.textReplacements);
        if (width >= 2) {
          this.addButton(kb, text, btn.callbackData, btn.url);
          kb.row();
          i += 1;
        } else {
          const next = rowButtons[i + 1];
          if (next && next.buttonWidth === 1) {
            const nextText = this.applyReplacements(
              next.text,
              opts.textReplacements,
            );
            this.addButton(kb, text, btn.callbackData, btn.url);
            this.addButton(kb, nextText, next.callbackData, next.url);
            kb.row();
            i += 2;
          } else {
            this.addButton(kb, text, btn.callbackData, btn.url);
            kb.row();
            i += 1;
          }
        }
      }
    }
    return kb;
  }

  private addButton(
    kb: InlineKeyboard,
    text: string,
    callbackData: string | null,
    url: string | null,
  ): void {
    if (callbackData) kb.text(text, callbackData);
    else if (url) kb.url(text, url);
  }

  private applyReplacements(
    text: string,
    replacements?: Record<string, string>,
  ): string {
    if (!replacements) return text;
    let out = text;
    for (const [k, v] of Object.entries(replacements)) {
      out = out.split(k).join(v);
    }
    return out;
  }
}
