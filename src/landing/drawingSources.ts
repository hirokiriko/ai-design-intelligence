import drawingA from './assets/design-dryer-a.jpg';
import drawingB from './assets/design-dryer-b.jpg';

export const drawingSources = [
  {
    label: '意匠A',
    registration: '登録第1821045号',
    article: 'ヘアドライヤー',
    applicant: 'テスコム電機株式会社',
    figure: '正面図',
    published: '2026年3月10日',
    src: drawingA,
    width: 730,
    height: 866,
    url: 'https://www.j-platpat.inpit.go.jp/c1801/DE/JP-2025-014915/30/ja',
    alt: '登録第1821045号のヘアドライヤーの正面図。頭部と把手に破線を含む原図。',
  },
  {
    label: '意匠B',
    registration: '登録第1822160号',
    article: 'ヘアドライヤー',
    applicant: 'テスコム電機株式会社',
    figure: '正面図',
    published: '2026年3月19日',
    src: drawingB,
    width: 736,
    height: 872,
    url: 'https://www.j-platpat.inpit.go.jp/c1801/DE/JP-2025-014912/30/ja',
    alt: '登録第1822160号のヘアドライヤーの正面図。環状の頭部と把手、下部の線群が描かれた原図。',
  },
] as const;
