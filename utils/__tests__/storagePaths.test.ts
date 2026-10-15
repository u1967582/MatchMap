import fs from 'fs';
import path from 'path';

import {
  STORAGE_BUCKETS,
  avatarPath,
  barImagePath,
  barPostImagePath,
  claimDocumentPath,
  storageOwnerFolder,
} from '~/utils/storagePaths';

// Las políticas de storage.objects (migración 20261015120000_audit01_…) solo
// dejan escribir si la PRIMERA carpeta de la ruta es el usuario (avatars,
// bar-claim-documents) o un bar del que es dueño (bar-images).

const USER_ID = '0a0a0a0a-0000-4000-8000-0000000a0001';
const BAR_ID = '0b0b0b0b-0000-4000-8000-0000000b0001';

describe('storagePaths', () => {
  it('usa los buckets que existen en Supabase', () => {
    expect(STORAGE_BUCKETS).toEqual({
      avatars: 'avatars',
      barImages: 'bar-images',
      claimDocuments: 'bar-claim-documents',
    });
  });

  it('avatarPath cuelga de la carpeta del usuario', () => {
    expect(avatarPath(USER_ID, 123)).toBe(`${USER_ID}/avatar_123.jpg`);
    expect(storageOwnerFolder(avatarPath(USER_ID))).toBe(USER_ID);
  });

  it('barImagePath cuelga de la carpeta del bar, separada por tipo', () => {
    expect(barImagePath(BAR_ID, 'bar', '0_123')).toBe(`${BAR_ID}/bar/bar_0_123.jpg`);
    expect(barImagePath(BAR_ID, 'menu', 456)).toBe(`${BAR_ID}/menu/menu_456.jpg`);
    expect(storageOwnerFolder(barImagePath(BAR_ID, 'menu', 1))).toBe(BAR_ID);
  });

  it('barPostImagePath cuelga de la carpeta del bar (no de la del post)', () => {
    expect(barPostImagePath(BAR_ID, 'post-1', 789)).toBe(`${BAR_ID}/posts/post_post-1_789.jpg`);
    expect(storageOwnerFolder(barPostImagePath(BAR_ID, 'post-1'))).toBe(BAR_ID);
  });

  it('claimDocumentPath cuelga de la carpeta de quien reclama, no del bar', () => {
    expect(claimDocumentPath(USER_ID, BAR_ID, 1)).toBe(`${USER_ID}/${BAR_ID}-1.jpg`);
    expect(storageOwnerFolder(claimDocumentPath(USER_ID, BAR_ID))).toBe(USER_ID);
  });

  it('usa Date.now() como marca de tiempo por defecto', () => {
    const spy = jest.spyOn(Date, 'now').mockReturnValue(42);
    try {
      expect(avatarPath(USER_ID)).toBe(`${USER_ID}/avatar_42.jpg`);
      expect(barPostImagePath(BAR_ID, 'p')).toBe(`${BAR_ID}/posts/post_p_42.jpg`);
      expect(claimDocumentPath(USER_ID, BAR_ID)).toBe(`${USER_ID}/${BAR_ID}-42.jpg`);
    } finally {
      spy.mockRestore();
    }
  });

  it('storageOwnerFolder devuelve null para rutas en la raíz del bucket', () => {
    // Formato antiguo de edit-bar-info: las políticas nuevas lo rechazan
    expect(storageOwnerFolder(`bar-${BAR_ID}-bar-1.jpg`)).toBeNull();
    expect(storageOwnerFolder('/avatar.jpg')).toBeNull();
    expect(storageOwnerFolder('')).toBeNull();
  });
});

describe('pantallas de subida', () => {
  // Guardia contra regresiones: las rutas antiguas no pasan las políticas de
  // Storage y el bucket 'post-images' no existe.
  const ROOT = path.resolve(__dirname, '../..');
  const UPLOAD_SCREENS = [
    'screens/EditProfileScreen.tsx',
    'screens/registerBar/Step4Photos.tsx',
    'app/create-post/[barId].tsx',
    'app/edit-post/[postId].tsx',
    'app/edit-bar-info/[barId].tsx',
    'app/claim-bar/[barId].tsx',
  ];

  it.each(UPLOAD_SCREENS)('%s usa utils/storagePaths y no rutas sueltas', (file) => {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    expect(source).toContain("from '~/utils/storagePaths'");
    expect(source).not.toMatch(/['"]post-images['"]/);
    expect(source).not.toMatch(/`bar-\$\{/);
    expect(source).not.toMatch(/`post-\$\{/);
    // Ningún .from('bucket') literal: siempre STORAGE_BUCKETS
    expect(source).not.toMatch(/storage\s*\.from\(\s*['"]/);
  });
});
