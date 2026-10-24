import { Injectable } from '@nestjs/common';
import { Between, LessThan } from 'typeorm';
import { LedgerEntry } from '../entities/ledger.entity';
import {
  LedgerAccount,
  LedgerDirection,
  PaymentChannel,
} from '../enums/fee.enum';
import { LedgerEntryRepository } from '../repositories/fee.repositories';

/** Cash for cash payments; cheques, cards and bank slips land in the bank. */
export const accountFor = (channel: PaymentChannel) =>
  channel === PaymentChannel.CASH ? LedgerAccount.CASH : LedgerAccount.BANK;

const signed = (e: Pick<LedgerEntry, 'direction' | 'amount'>) =>
  e.direction === LedgerDirection.INCOME ? e.amount : -e.amount;

/**
 * The single-entry cash and bank ledger (PRD 6.10): every payment,
 * reversal, refund and expense writes one entry in its own transaction.
 * The cash book and bank book read it back with running balances.
 */
@Injectable()
export class LedgerService {
  constructor(private readonly entryRepo: LedgerEntryRepository) {}

  async record(
    entry: Omit<LedgerEntry, 'id' | 'orgId' | 'createdAt'>,
  ): Promise<void> {
    await this.entryRepo.saveNew(entry);
  }

  /** Opening balance, the entries with a running balance, closing balance. */
  async book(account: LedgerAccount, from: string, to: string) {
    const before = await this.entryRepo.find({
      where: { account, date: LessThan(from) },
      select: { id: true, direction: true, amount: true },
    });
    const opening = before.reduce((n, e) => n + signed(e), 0);
    const entries = await this.entryRepo.find({
      where: { account, date: Between(from, to) },
      order: { date: 'ASC', createdAt: 'ASC' },
    });
    let balance = opening;
    const rows = entries.map((e) => {
      balance += signed(e);
      return {
        id: e.id,
        date: e.date,
        description: e.description,
        sourceType: e.sourceType,
        sourceId: e.sourceId,
        income: e.direction === LedgerDirection.INCOME ? e.amount : 0,
        expense: e.direction === LedgerDirection.EXPENSE ? e.amount : 0,
        balance,
      };
    });
    return {
      account,
      from,
      to,
      opening,
      income: rows.reduce((n, r) => n + r.income, 0),
      expense: rows.reduce((n, r) => n + r.expense, 0),
      closing: balance,
      entries: rows,
    };
  }
}
