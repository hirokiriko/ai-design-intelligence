import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ArrowRightIcon, ArrowUpRightIcon, MinusIcon, PlusIcon } from '@phosphor-icons/react';
import ContactSection from './ContactSection';
import { DiscussionMaterial, ResearchFlowDiagram, ResearchHistoryDiagram } from './ValueDiagrams';
import { experienceTabs, landingContent as copy, type ExperienceTab } from './content';
import { drawingSources } from './drawingSources';
import './landing.css';

function Brand() {
  return <a className="lp-brand" href="#top" aria-label="Design Signals トップへ">Design Signals</a>;
}

function PrimaryLink({ label = copy.primaryCta }: { label?: string }) {
  return <a className="lp-button lp-button-primary" href="#contact">{label}<ArrowRightIcon size={20} aria-hidden="true" />
  </a>;
}

function DrawingPair({ priority = false, detailed = false }: { priority?: boolean; detailed?: boolean }) {
  return (
    <div className="lp-drawing-pair">
      {drawingSources.map((drawing) => (
        <figure className="lp-drawing-figure" key={drawing.registration}>
          <figcaption className="lp-drawing-title">
            <strong>{drawing.label}</strong>
            <span>{drawing.registration}</span>
          </figcaption>
          <div className="lp-drawing-image-frame"><img
            className="lp-drawing-image"
            src={drawing.src}
            width={drawing.width}
            height={drawing.height}
            alt={drawing.alt}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
          /></div>
          <p className="lp-drawing-caption">
            <a href={drawing.url} target="_blank" rel="noreferrer" aria-label={`${drawing.registration}の${drawing.figure}を公報で確認`}>{drawing.figure}・原典へ<ArrowUpRightIcon size={12} aria-hidden="true" />
            </a>
          </p>
          {detailed && <p className="lp-drawing-publication">特許庁 登録意匠公報（引用）<br />公報発行日：{drawing.published}<br />公報記載の出願人：{drawing.applicant}</p>}
        </figure>
      ))}
    </div>
  );
}

function DrawingPreview() {
  return (
    <div className="lp-hero-evidence" aria-label="登録意匠公報の正面図の引用">
      <DrawingPair priority />
      <p className="lp-hero-source">出典：特許庁 登録意匠公報・正面図（引用）</p>
      <p className="lp-hero-evidence-caption">線種・部位・対象範囲を、原図に戻って確かめる。</p>
      <div className="lp-hero-evidence-flow" aria-label="根拠を確かめる流れ">
        <span>図面の確認</span>
        <ArrowRightIcon aria-hidden="true" size={18} />
        <span>公式情報と照合</span>
        <ArrowRightIcon aria-hidden="true" size={18} />
        <span>次の調査へ</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ExperienceTab>('drawings');
  const [focusIndex, setFocusIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const menuButton = useRef<HTMLButtonElement>(null);
  const tabButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogOpener = useRef<HTMLElement | null>(null);
  const selectedFocus = copy.focusPoints[focusIndex];

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % experienceTabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + experienceTabs.length) % experienceTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = experienceTabs.length - 1;
    else return;
    event.preventDefault();
    setActiveTab(experienceTabs[nextIndex].id);
    tabButtons.current[nextIndex]?.focus();
  };

  const openDrawing = (event: MouseEvent<HTMLButtonElement>) => {
    dialogOpener.current = event.currentTarget;
    setZoom(100);
    dialog.current?.showModal();
  };

  return (
    <div className="lp-root" id="top">
      <a className="lp-skip-link" href="#main">本文へ移動</a>
      <header className="lp-header">
        <div className="lp-container lp-header-inner">
          <Brand />
          <button ref={menuButton} className="lp-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="lp-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? '閉じる' : 'メニュー'}</button>
          <nav id="lp-navigation" className={`lp-navigation${menuOpen ? ' lp-navigation-open' : ''}`} aria-label="メインナビゲーション">
            {copy.navigation.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}
            <a className="lp-nav-cta" href="#contact" onClick={() => setMenuOpen(false)}>{copy.primaryCta}<ArrowRightIcon size={18} aria-hidden="true" />
            </a>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="lp-hero-section" aria-labelledby="lp-hero-heading">
          <div className="lp-container lp-hero">
            <div className="lp-hero-copy">
              <p className="lp-hero-kicker">{copy.hero.eyebrow}</p>
              <h1 id="lp-hero-heading">{copy.hero.titleLines[0]}<br />{copy.hero.titleLines[1]}</h1>
              <p className="lp-hero-deck">{copy.hero.lead}</p>
              <div className="lp-hero-actions">
                <PrimaryLink />
                <a className="lp-text-link" href="#features">{copy.secondaryCta}<ArrowRightIcon size={18} aria-hidden="true" />
                </a>
              </div>
              <p className="lp-hero-status">開発・検証中。対象・収録範囲に応じて活用をご相談ください。</p>
            </div>
            <DrawingPreview />
          </div>
        </section>

        <ResearchFlowDiagram />

        <section className="lp-section lp-pain-section lp-container" aria-labelledby="lp-pain-heading">
          <div className="lp-section-heading lp-heading-split">
            <div>
              <p className="lp-eyebrow">RESEARCH INTO DISCUSSION</p>
              <h2 id="lp-pain-heading">集めた資料を、<br />社内で話が進む材料に。</h2>
            </div>
            <p className="lp-section-intro">{copy.hero.description}</p>
          </div>
          <div className="lp-pain-list">
            {copy.painPoints.map((item) => (
              <article className="lp-pain-row" key={item.number}>
                <span className="lp-pain-number">{item.number}</span>
                <div className="lp-pain-before">
                  <h3>{item.title}</h3>
                  <p>{item.pain}</p>
                </div>
                <ArrowRightIcon className="lp-pain-arrow" size={24} weight="light" aria-hidden="true" />
                <div className="lp-pain-after">
                  <p>{item.solution}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-experience-section" id="experience" aria-labelledby="lp-experience-heading">
          <div className="lp-container lp-experience-grid">
            <div className="lp-experience-copy">
              <p className="lp-eyebrow">EVIDENCE IN PRACTICE</p>
              <h2 id="lp-experience-heading">図面から、<br />企画の検討材料へ。</h2>
              <p>競合の意匠を、原図・公報で確かめる。企業公式情報と照らし、何を確認でき、何をさらに調べるかを考えます。</p>
              <p>ここでは、ヘアドライヤーの正面図を使って、原図を確かめる操作の一部を紹介します。</p>
              <p className="lp-evidence-boundary">掲載図面は登録意匠公報からの引用です。線種や対象範囲は、公報の説明もあわせて確認してください。</p>
              <a className="lp-text-link" href="#contact">御社の調査での活用を相談する<ArrowRightIcon size={18} aria-hidden="true" />
              </a>
            </div>
            <div className="lp-experience-workspace">
              <div className="lp-workspace-top">
                <div className="lp-tabs" role="tablist" aria-label="確認するステップ">
                  {experienceTabs.map((tab, index) => (
                    <button key={tab.id} ref={(element) => { tabButtons.current[index] = element; }} className="lp-tab" id={`lp-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`lp-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => setActiveTab(tab.id)} onKeyDown={(event) => handleTabKey(event, index)}>{tab.label}</button>
                  ))}
                </div>
                <span className="lp-workspace-label">公報の原図</span>
              </div>
              <div className="lp-tab-panel" id="lp-panel-drawings" role="tabpanel" tabIndex={0} aria-labelledby="lp-tab-drawings" hidden={activeTab !== 'drawings'}>
                <DrawingPair detailed />
                <button className="lp-expand-button" type="button" onClick={openDrawing}>原図を大きく見る<ArrowUpRightIcon size={17} aria-hidden="true" />
                </button>
                <div className="lp-focus-picker" aria-label="原図で確認する観点">
                  {copy.focusPoints.map((point, index) => <button className="lp-focus-button" type="button" aria-pressed={focusIndex === index} key={point.label} onClick={() => setFocusIndex(index)}>{point.label}</button>)}
                </div>
                <div className="lp-focus-description" aria-live="polite" aria-atomic="true">
                  <p className="lp-eyebrow">確認する視点</p>
                  <h3>{selectedFocus.title}</h3>
                  <p>{selectedFocus.text}</p>
                  <p className="lp-next-note">
                    <strong>次に確かめたいこと</strong>{selectedFocus.next}</p>
                </div>
              </div>
              <div className="lp-tab-panel lp-source-panel" id="lp-panel-sources" role="tabpanel" tabIndex={0} aria-labelledby="lp-tab-sources" hidden={activeTab !== 'sources'}>
                <p className="lp-eyebrow">CHECK THE SOURCE</p>
                <h3>図面から見えることを、公式情報と照らす。</h3>
                <p className="lp-panel-intro">商品の用途や機能は、図面だけでは確かめきれません。対象と日付、資料間の対応を確認しながら、企業が説明していることを読みます。</p>
              <article className="lp-official-source" aria-labelledby="lp-official-source-title">
                <p className="lp-official-source-meta">{copy.officialSource.publisher}｜{copy.officialSource.date}</p>
                <h4 id="lp-official-source-title"><a href={copy.officialSource.url} target="_blank" rel="noreferrer">{copy.officialSource.title}<ArrowUpRightIcon size={17} aria-hidden="true" /></a></h4>
                <p>{copy.officialSource.summary}</p>
                <p className="lp-official-source-scope">{copy.officialSource.scopeNote}</p>
              </article>
                <div className="lp-source-list">{copy.sources.map((source, index) => <article className="lp-source-row" key={source.title}>
                  <span className="lp-source-number">0{index + 1}</span>
                  <div>
                    <h4>{source.title}</h4>
                    <p>{source.text}</p>
                    <span className="lp-source-status">{source.status}</span>
                  </div>
                </article>)}</div>
              <p className="lp-panel-footnote">原典リンクから企業の発表を確認できます。このLPの操作では、新しい資料の収集やAI分析は実行しません。</p>
                <button className="lp-button lp-button-secondary" type="button" onClick={() => { setActiveTab('questions'); tabButtons.current[2]?.focus(); }}>次の調査へ進む<ArrowRightIcon size={18} aria-hidden="true" />
                </button>
              </div>
              <div className="lp-tab-panel lp-question-panel" id="lp-panel-questions" role="tabpanel" tabIndex={0} aria-labelledby="lp-tab-questions" hidden={activeTab !== 'questions'}>
                <p className="lp-eyebrow">YOUR NEXT RESEARCH</p>
                <h3>確認した根拠から、次の調査を考える。</h3>
                <p className="lp-panel-intro">見えた特徴を商品の狙いや世代の変化と結びつける前に、必要な資料と確認条件を整理します。</p>
                <div className="lp-question-list">{copy.nextQuestions.map((question, index) => <article key={question.title}>
                  <span className="lp-step-number">0{index + 1}</span>
                  <h4>{question.title}</h4>
                  <p>{question.text}</p>
                </article>)}</div>
                <a className="lp-text-link" href="#use-cases">仕事での使いどころを見る<ArrowRightIcon size={18} aria-hidden="true" />
                </a>
              </div>
              <p className="lp-workspace-boundary">このページの操作では、実データの新規取得・AI分析・結果の保存は行いません。</p>
            </div>
          </div>
        </section>



        <ResearchHistoryDiagram />

        <DiscussionMaterial />

        <section className="lp-section lp-comparison-section" id="comparison" aria-labelledby="lp-comparison-heading">
          <div className="lp-container">
            <div className="lp-section-heading">
              <p className="lp-eyebrow">CHOOSE THE RIGHT WORKFLOW</p>
              <h2 id="lp-comparison-heading">Signalsとワークベンチ。<br />仕事の目的で使い分ける。</h2>
              <p className="lp-section-intro">企業・商品分野の動向を追う仕事と、案件ごとの調査記録を引き渡す仕事。<br className="lp-desktop-break" />起点となる問いと、残す成果に応じて選べます。</p>
            </div>
            <table className="lp-comparison-table" role="table">
              <caption className="lp-visually-hidden">Design Signalsと意匠調査ワークベンチの目的・使い方の比較</caption>
              <thead role="rowgroup">
                <tr role="row">
                  <th id="lp-comparison-label" scope="col" role="columnheader">比較項目</th>
                  <th id="lp-signals-column" scope="col" role="columnheader">Design Signals</th>
                  <th id="lp-workbench-column" scope="col" role="columnheader">意匠調査ワークベンチ</th>
                </tr>
              </thead>
              <tbody role="rowgroup">{copy.comparisonRows.map((row, index) => <tr role="row" key={row.label}>
                <th id={`lp-comparison-row-${index}`} scope="row" role="rowheader">{row.label}</th>
                <td headers={`lp-signals-column lp-comparison-row-${index}`} role="cell">
                  <span className="lp-mobile-column-label" aria-hidden="true">Design Signals</span>{row.signals}</td>
                <td headers={`lp-workbench-column lp-comparison-row-${index}`} role="cell">
                  <span className="lp-mobile-column-label" aria-hidden="true">意匠調査ワークベンチ</span>{row.workbench}</td>
              </tr>)}</tbody>
            </table>
            <div className="lp-product-choice">
              <p>
                <span>企業・商品分野を継続して追うなら</span>
                <strong>Design Signals</strong>
              </p>
              <p>
                <span>案件の調査記録を引き渡すなら</span>
                <strong>意匠調査ワークベンチ</strong>
              </p>
            </div>
          </div>
        </section>

        <section className="lp-section lp-container lp-faq-section" id="faq" aria-labelledby="lp-faq-heading">
          <div className="lp-section-heading">
            <p className="lp-eyebrow">FAQ</p>
            <h2 id="lp-faq-heading">検討を始める前に。</h2>
            <p>Design Signalsの使い方と、<br className="lp-desktop-break" />お伝えできる範囲について。</p>
          </div>
          <div className="lp-faq-list">{copy.faq.map((item) => <details className="lp-faq-item" key={item.question}>
            <summary>{item.question}<span className="lp-faq-indicator" aria-hidden="true">
              <PlusIcon className="lp-faq-plus" size={20} />
              <MinusIcon className="lp-faq-minus" size={20} />
            </span>
            </summary>
            <p>{item.answer}</p>
          </details>)}</div>
        </section>
        <ContactSection />
      </main>

      <footer className="lp-footer lp-container">
        <div className="lp-footer-top">
          <Brand />
          <nav aria-label="フッターナビゲーション">
            <a href="#features">仕組みと強み</a>
            <a href="#experience">原図の確認</a>
            <a href="#comparison">製品の違い</a>
            <a href="#contact">お問い合わせ</a>
          </nav>
        </div>
        <div className="lp-footer-bottom">
          <p>図面の出典：特許庁 登録意匠公報（引用）<span>引用図面の権利は各権利者に帰属します。</span>
            <span>Design Signals｜開発・検証中</span>
          </p>
          <p>© 2026 Design Signals</p>
        </div>
      </footer>

      <dialog ref={dialog} className="lp-drawing-dialog" aria-labelledby="lp-dialog-title" onClose={() => dialogOpener.current?.focus()}>
        <div className="lp-dialog-header">
          <div>
            <p className="lp-eyebrow">ORIGINAL DESIGN DRAWINGS</p>
            <h2 id="lp-dialog-title">意匠A・Bの原図を確かめる</h2>
          </div>
          <button className="lp-button lp-button-secondary lp-dialog-close" type="button" onClick={() => dialog.current?.close()}>閉じる</button>
        </div>
        <p className="lp-dialog-note">特許庁 登録意匠公報の正面図（引用）。同日出願の2件であり、新旧や世代の変化を示すものではありません。</p>
        <div className="lp-zoom-controls" aria-label="原図の表示倍率">
          <span>表示倍率</span>{[100, 150, 200].map((value) => <button className="lp-zoom-button" type="button" aria-pressed={zoom === value} key={value} onClick={() => setZoom(value)}>{value}%</button>)}</div>
        <div className="lp-dialog-image-viewport" tabIndex={0} aria-label="拡大した原図。倍率が高い場合はスクロールできます。">
          <div className="lp-dialog-pair" style={{ width: `${zoom}%` }}>
            <DrawingPair detailed />
          </div>
        </div>
        <p className="lp-dialog-footnote">表示上の大きさは実寸や同一縮尺を示しません。対象範囲や線種は公報原文からご確認ください。</p>
      </dialog>
    </div>
  );
}
