import { createRoot, createSignal } from 'solid-js';

export interface AboutSong {
  readonly url: string;
  readonly startSeconds: number;
}

export interface AboutCard {
  readonly key: number;
  readonly song: AboutSong | null;
}

const ABOUT_SONG_DIRECTORY = '/mp3/about';
const ABOUT_SONG_START_PATTERN = /_(\d+(?:\.\d+)?)$/;

const discoveredSongs = (): readonly string[] =>
  Object.keys(import.meta.glob('/public/mp3/about/*.mp3', { eager: true, query: '?url', import: 'default' }))
    .map(path => path.split('/').pop() ?? '')
    .filter(name => name.toLowerCase().endsWith('.mp3'))
    .map(name => name.replace(/\.mp3$/i, ''))
    .sort();

export const ABOUT_SONGS: readonly string[] = discoveredSongs();

const [card, setCard] = createRoot(() => createSignal<AboutCard | null>(null));

const shuffleBag: string[] = [];

export { card as aboutCard };

export const closeAbout = (): void => {
  setCard(null);
};

const aboutSong = (name: string): AboutSong => {
  const startSeconds = Number(ABOUT_SONG_START_PATTERN.exec(name)?.[1] ?? 0);
  return { url: `${ABOUT_SONG_DIRECTORY}/${name}.mp3`, startSeconds };
};

export const randomAboutSong = (): AboutSong | null => {
  if (ABOUT_SONGS.length === 0) return null;
  if (shuffleBag.length === 0) shuffleBag.push(...ABOUT_SONGS);
  const song = shuffleBag.pop();
  return song ? aboutSong(song) : null;
};

export const openAbout = (): void => {
  setCard(current => ({
    key: (current?.key ?? 0) + 1,
    song: randomAboutSong(),
  }));
};
