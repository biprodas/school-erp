import { ConfigService } from '@nestjs/config';
import { DnsResolver, DomainDnsService } from './domain-dns.service';

const TOKEN = 'a'.repeat(64);

const dnsError = (code: string) => Object.assign(new Error(code), { code });

describe('DomainDnsService', () => {
  let resolver: { [K in keyof DnsResolver]: jest.Mock };
  let service: DomainDnsService;

  beforeEach(() => {
    resolver = { resolveCname: jest.fn(), resolveTxt: jest.fn() };
    const config = {
      getOrThrow: () => ({ cnameTarget: 'schools.example.com' }),
    } as unknown as ConfigService;
    service = new DomainDnsService(resolver, config);
  });

  it('lists the CNAME and TXT records to create', () => {
    expect(service.records('erp.test.edu', TOKEN)).toEqual([
      { type: 'CNAME', name: 'erp.test.edu', value: 'schools.example.com' },
      { type: 'TXT', name: '_school-verify.erp.test.edu', value: TOKEN },
    ]);
  });

  it('passes when both records match (case, trailing dot, split TXT)', async () => {
    resolver.resolveCname.mockResolvedValue(['Schools.Example.com.']);
    resolver.resolveTxt.mockResolvedValue([
      ['other'],
      [TOKEN.slice(0, 10), TOKEN.slice(10)],
    ]);

    await expect(service.check('erp.test.edu', TOKEN)).resolves.toEqual({
      cname: true,
      txt: true,
    });
    expect(resolver.resolveTxt).toHaveBeenCalledWith(
      '_school-verify.erp.test.edu',
    );
  });

  it('fails a CNAME to another host and a wrong token', async () => {
    resolver.resolveCname.mockResolvedValue(['evil.example.net']);
    resolver.resolveTxt.mockResolvedValue([['b'.repeat(64)]]);

    await expect(service.check('erp.test.edu', TOKEN)).resolves.toEqual({
      cname: false,
      txt: false,
    });
  });

  it('treats missing records and lookup errors as failing, not throwing', async () => {
    resolver.resolveCname.mockRejectedValue(dnsError('ENODATA'));
    resolver.resolveTxt.mockRejectedValue(dnsError('ESERVFAIL'));

    await expect(service.check('erp.test.edu', TOKEN)).resolves.toEqual({
      cname: false,
      txt: false,
    });
  });
});
