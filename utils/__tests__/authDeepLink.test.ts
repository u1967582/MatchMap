import { parseAuthDeepLink } from '../authDeepLink';

const TOKENS = 'access_token=AT&refresh_token=RT';

describe('parseAuthDeepLink', () => {
  it('acepta tokens en el hash de auth/callback', () => {
    expect(parseAuthDeepLink(`matchmap://auth/callback#${TOKENS}`)).toEqual({
      kind: 'callback',
      accessToken: 'AT',
      refreshToken: 'RT',
    });
  });

  it('acepta tokens en query params de auth/callback', () => {
    expect(parseAuthDeepLink(`matchmap://auth/callback?${TOKENS}`)).toMatchObject({
      kind: 'callback',
      accessToken: 'AT',
    });
  });

  it('acepta las URLs de desarrollo de Expo', () => {
    expect(parseAuthDeepLink(`exp://192.168.1.10:8081/--/auth/callback#${TOKENS}`)).toMatchObject({
      kind: 'callback',
    });
  });

  it('acepta reset-password solo con type=recovery', () => {
    expect(
      parseAuthDeepLink(`matchmap://auth/reset-password#${TOKENS}&type=recovery`)
    ).toMatchObject({ kind: 'recovery' });
    expect(parseAuthDeepLink(`matchmap://auth/reset-password#${TOKENS}`)).toBeNull();
    expect(parseAuthDeepLink(`matchmap://auth/reset-password#${TOKENS}&type=signup`)).toBeNull();
  });

  it('ignora tokens en cualquier otra ruta', () => {
    expect(parseAuthDeepLink(`matchmap://map#${TOKENS}`)).toBeNull();
    expect(parseAuthDeepLink(`matchmap://bar-profile/123?${TOKENS}`)).toBeNull();
    expect(parseAuthDeepLink(`matchmap://evil?next=auth/callback#${TOKENS}`)).toBeNull();
  });

  it('devuelve null si falta alguno de los tokens', () => {
    expect(parseAuthDeepLink('matchmap://auth/callback#access_token=AT')).toBeNull();
    expect(parseAuthDeepLink('matchmap://auth/callback')).toBeNull();
  });
});
