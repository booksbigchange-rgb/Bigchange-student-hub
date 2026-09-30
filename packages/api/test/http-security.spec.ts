import { corsOrigins } from '../src/config/http-security';

describe('HTTP deployment policy', () => {
  it('keeps the local development default', () => {
    expect(corsOrigins({})).toEqual(['http://localhost:3000']);
  });
  it.each([undefined, '', '   ', '*', 'null', 'http://school.example',
    'https://school.example/path', 'https://school.example/',
    'https://user:password@school.example', 'https://*.example',
    'https://school.example,', 'https://school.example?x=1'])('rejects unsafe production origin %s', (origin) => {
    expect(() => corsOrigins({ NODE_ENV: 'production', CORS_ORIGIN: origin })).toThrow();
  });
  it('trims and deduplicates exact HTTPS origins', () => {
    expect(corsOrigins({ NODE_ENV: 'production', CORS_ORIGIN:
      ' https://school.example,https://parents.example,https://school.example ' }))
      .toEqual(['https://school.example', 'https://parents.example']);
  });
});
