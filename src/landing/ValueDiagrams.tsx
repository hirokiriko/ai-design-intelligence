import { useRef, useState, type MouseEvent } from 'react';
import { ArrowRightIcon, ArrowsOutIcon, BooksIcon, LightbulbIcon, WrenchIcon } from '@phosphor-icons/react';
import researchFlow from './assets/research-flow.png';
import researchHistory from './assets/research-history.png';
import researchFlowMobile from './assets/research-flow-mobile.png';
import researchHistoryMobile from './assets/research-history-mobile.png';
import { landingContent as copy } from './content';
import { drawingSources } from './drawingSources';
import './diagrams.css';

type DiagramProps = {
  id: string;
  src: string;
  mobileSrc: string;
  mobileWidth: number;
  mobileHeight: number;
  alt: string;
  title: string;
  width: number;
  height: number;
  note: string;
};

function ExpandableDiagram({ id, src, mobileSrc, mobileWidth, mobileHeight, alt, title, width, height, note }: DiagramProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const [zoom, setZoom] = useState<'fit' | number>('fit');
  const [naturalWidth, setNaturalWidth] = useState(width);

  const openDiagram = (event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setZoom('fit');
    dialog.current?.showModal();
  };

  return (
    <figure className="lp-value-diagram">
      <picture>
        <source media="(max-width: 700px)" srcSet={mobileSrc} width={mobileWidth} height={mobileHeight} />
        <img className="lp-value-diagram-image" src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" />
      </picture>
      <figcaption className="lp-value-diagram-caption">
        <span>{note}</span>
        <button className="lp-value-diagram-enlarge" type="button" onClick={openDiagram} aria-label={`${title}の図を大きく見る`}>
          <ArrowsOutIcon size={17} aria-hidden="true" />図を大きく見る
        </button>
      </figcaption>
      <dialog
        ref={dialog}
        className="lp-value-dialog"
        aria-labelledby={`${id}-dialog-title`}
        onClose={() => opener.current?.focus()}
      >
        <div className="lp-value-dialog-header">
          <h2 id={`${id}-dialog-title`}>{title}</h2>
          <button className="lp-button lp-button-secondary" type="button" onClick={() => dialog.current?.close()}>閉じる</button>
        </div>
        <div className="lp-value-dialog-tools" aria-label="図の表示倍率">
          <span>表示倍率</span>
          <button type="button" className="lp-value-zoom" aria-pressed={zoom === 'fit'} onClick={() => setZoom('fit')}>全体</button>
          {[100, 150, 200].map((value) => (
            <button key={value} type="button" className="lp-value-zoom" aria-pressed={zoom === value} onClick={() => setZoom(value)}>{value}%</button>
          ))}
        </div>
        <div className="lp-value-dialog-viewport" tabIndex={0} aria-label="拡大した説明図。倍率が高い場合はスクロールできます。">
          <picture>
            <source media="(max-width: 700px)" srcSet={mobileSrc} width={mobileWidth} height={mobileHeight} />
            <img
              src={src}
              alt={alt}
              width={width}
              height={height}
              loading="lazy"
              decoding="async"
              data-fit={zoom === 'fit'}
              onLoad={(event) => setNaturalWidth(event.currentTarget.naturalWidth)}
              style={{ width: zoom === 'fit' ? '100%' : `${naturalWidth * zoom / 100}px` }}
            />
          </picture>
        </div>
        <p className="lp-value-dialog-note">{note}</p>
      </dialog>
    </figure>
  );
}

export function ResearchFlowDiagram() {
  return (
    <section className="lp-value-flow-section" id="features" aria-labelledby="lp-features-heading">
      <div className="lp-container">
        <div className="lp-value-heading">
          <p className="lp-eyebrow">FROM SOURCES TO DISCUSSION</p>
          <h2 id="lp-features-heading">資料の束を、<br className="lp-value-mobile-break" />社内で話せる論点へ。</h2>
          <p>意匠と企業公式情報を読み合わせ、注目する理由と、次に確かめることを整理します。</p>
        </div>
        <ExpandableDiagram
          id="lp-research-flow"
          src={researchFlow}
          mobileSrc={researchFlowMobile}
          mobileWidth={1006}
          mobileHeight={1564}
          width={2009}
          height={783}
          title="資料から企画・開発の検討材料へ"
          alt="意匠公報と企業公式情報から、対象と時期、画像と公式記載、事実・仮説・未確認を確認し、注目点・根拠・次の調査を整理して企画・開発へ伝える流れ。"
          note="製品として目指す利用の流れを示す説明図です。確認できる範囲は収録資料によります。"
        />
        <div className="lp-value-flow-steps">
          <article><span>01</span><h3>見る</h3><p>企業・商品分野の注目点から、個別の公報と図面へ。</p></article>
          <article><span>02</span><h3>照らす</h3><p>企業の公式記載と読み合わせ、事実・仮説・未確認を分ける。</p></article>
          <article><span>03</span><h3>次に伝える</h3><p>注目した理由、根拠、次に確かめることを、検討の論点に。</p></article>
        </div>
      </div>
    </section>
  );
}

export function ResearchHistoryDiagram() {
  return (
    <section className="lp-value-history-section" id="system" aria-labelledby="lp-system-heading">
      <div className="lp-container lp-value-history-layout">
        <div className="lp-value-history-copy">
          <p className="lp-eyebrow">KEEP THE CONTEXT</p>
          <h2 id="lp-system-heading">前回の調査を、<br />次回の出発点に。</h2>
          <p>過去に何を、いつ、どこまで確かめたか。その前提へ戻れることが、継続して追う仕事を支えます。</p>
          <p>入力を更新して調べた結果は、以前の結果とは別に残す。確認した範囲をそろえながら、次に追う対象を考えます。</p>
        </div>
        <div className="lp-value-history-visual">
          <ExpandableDiagram
            id="lp-research-history"
            src={researchHistory}
            mobileSrc={researchHistoryMobile}
            mobileWidth={971}
            mobileHeight={1619}
            width={1513}
            height={1040}
            title="前回と更新後の保存結果を確かめる"
            alt="前回の保存結果Aと、入力更新後の保存結果Bを別々に残し、それぞれの対象範囲・根拠・日付を確認して比べる考え方。過去の結果は上書きせずに保持する。"
            note="保存結果を扱う考え方を示す説明図です。"
          />
          <div className="lp-value-history-summary"><strong>前回の結果は、そのまま残す。<br className="lp-value-mobile-break" />更新後は、別に残す。</strong><p>対象範囲・根拠・日付を確かめて比べる。</p></div>
        </div>
      </div>
    </section>
  );
}

export function DiscussionMaterial() {
  return (
    <section className="lp-value-discussion-section" id="use-cases" aria-labelledby="lp-use-cases-heading">
      <div className="lp-container">
        <div className="lp-value-heading">
          <p className="lp-eyebrow">MAKE IT DISCUSSABLE</p>
          <h2 id="lp-use-cases-heading">次の会議で、<br className="lp-value-mobile-break" />何を話すかまで。</h2>
          <p>注目点と根拠をそろえ、知財の気づきを企画・開発が考える論点へつなぎます。</p>
        </div>
        <article className="lp-discussion-paper" aria-labelledby="lp-discussion-paper-title">
          <header className="lp-discussion-paper-header">
            <div><p className="lp-discussion-paper-category">検討の観点</p><h3 id="lp-discussion-paper-title">社内で話す論点の組み立て方</h3></div>
            <p>対象分野：ヘアドライヤー<br />公報の原図と企業公式発表から</p>
          </header>
          <dl className="lp-discussion-topics">
            <div className="lp-discussion-topic"><dt><span>01</span>注目した理由</dt><dd>同じ商品分野の2件の正面図から、線種と操作部を確かめる。形の印象をそのまま商品の狙いとせず、どの資料で何を確認するかを考える。</dd></div>
            <div className="lp-discussion-topic"><dt><span>02</span>確認した根拠</dt><dd><ul>{drawingSources.map((source) => <li key={source.registration}><a href={source.url} target="_blank" rel="noreferrer">{source.registration}・{source.figure}</a></li>)}<li><a href={copy.officialSource.url} target="_blank" rel="noreferrer">企業公式発表・{copy.officialSource.date}</a></li></ul></dd></div>
            <div className="lp-discussion-topic"><dt><span>03</span>事実と仮説</dt><dd>公報には正面図があり、企業は2026年10月7日にヘアドライヤーの新製品を発表している。形状と発表内容の関係は、資料を照合して確かめる論点として扱う。</dd></div>
            <div className="lp-discussion-topic lp-discussion-topic-question"><dt><span>04</span>未確認と次の問い</dt><dd><strong>図面と製品の直接対応は未確認。</strong><p>公報の説明や他の図面で、線種と意匠の対象範囲を確認する。企業公式情報と同じ対象を指すのか、結び付けられる根拠を確かめる。</p></dd></div>
          </dl>
          <p className="lp-discussion-editorial-note">掲載した公報と公式発表を用いた編集上の整理です。保存されたAI分析結果や、自動生成した会議資料ではありません。</p>
        </article>
        <div className="lp-discussion-roles" aria-label="部門ごとの検討の視点">
          <div><BooksIcon size={27} weight="light" aria-hidden="true" /><p><strong>知財</strong><span>根拠と確認範囲</span></p></div>
          <div><LightbulbIcon size={27} weight="light" aria-hidden="true" /><p><strong>企画</strong><span>検討するテーマ</span></p></div>
          <div><WrenchIcon size={27} weight="light" aria-hidden="true" /><p><strong>開発</strong><span>追加で確かめること</span></p></div>
        </div>
        <a className="lp-text-link lp-discussion-contact" href="#contact">御社の調査・社内説明での活用を相談する<ArrowRightIcon size={18} aria-hidden="true" /></a>
      </div>
    </section>
  );
}
