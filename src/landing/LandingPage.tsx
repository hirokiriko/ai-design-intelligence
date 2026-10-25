import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ArrowRightIcon, ArrowUpRightIcon, MinusIcon, PlusIcon } from '@phosphor-icons/react';
import lampComparison from './assets/lamp-comparison.png';
import { experienceTabs, landingContent as copy, type ExperienceTab } from './content';
import './landing.css';

function Brand() {
  return <a className="lp-brand" href="#top" aria-label="KIRIKO Design Signals トップへ">
    <span className="lp-brand-mark" aria-hidden="true">K</span>
    <span>
      <strong>KIRIKO</strong> <span className="lp-brand-name">Design Signals</span>
    </span>
  </a>;
}

function PrimaryLink({ label = copy.primaryCta }: { label?: string }) {
  return <a className="lp-button lp-button-primary" href="#experience">{label}<ArrowRightIcon className="lp-link-arrow" size={20} aria-hidden="true" />
  </a>;
}

function DrawingPreview() {
  return <div className="lp-preview" aria-label="図面比較の画面イメージ">
    <div className="lp-preview-header">
      <strong>図面を並べて、違いを確かめる</strong>
      <span>{copy.sampleLabel}</span>
    </div>
    <div className="lp-preview-body">
      <div className="lp-preview-candidates">
        <span className="lp-preview-eyebrow">比較対象 2件</span>
        <div className="lp-preview-candidate lp-preview-candidate-selected">
          <strong>候補 A</strong>
          <span>テーブルランプ</span>
          <span>丸みのあるシェード</span>
        </div>
        <div className="lp-preview-candidate">
          <strong>候補 B</strong>
          <span>テーブルランプ</span>
          <span>直線的なシェード</span>
        </div>
      </div>
      <div className="lp-preview-drawings">
        <div className="lp-comparison-labels">
          <span>比較 A 正面図</span>
          <span>比較 B 正面図</span>
        </div>
        <img src={lampComparison} alt="丸いドーム型のシェードと台形のシェードを持つ、架空のテーブルランプ2点の比較図" width="1484" height="1060" fetchPriority="high" />
      </div>
      <div className="lp-preview-note">
        <strong>確認したい点</strong>
        <ul>
          <li>シェードの輪郭</li>
          <li>部位のつながり</li>
          <li>全体の構成</li>
        </ul>
        <span>気づきから、次の問いへ。</span>
      </div>
    </div>
  </div>;
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

  return <div className="lp-root" id="top">
    <a className="lp-skip-link" href="#main">本文へ移動</a>
    <header className="lp-header">
      <div className="lp-container lp-header-inner">
        <Brand />
        <button ref={menuButton} className="lp-menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="lp-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? '閉じる' : 'メニュー'}</button>
        <nav id="lp-navigation" className={`lp-navigation${menuOpen ? ' lp-navigation-open' : ''}`} aria-label="メインナビゲーション">
          {copy.navigation.map((item) => <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}
          <a className="lp-nav-cta" href="#experience" onClick={() => setMenuOpen(false)}>体験する</a>
        </nav>
      </div>
    </header>

    <main id="main">
      <section className="lp-hero lp-container" aria-labelledby="lp-hero-heading">
        <div className="lp-hero-copy">
          <h1 id="lp-hero-heading">意匠の変化を、<br />次の検討へ。</h1>
          <p className="lp-hero-deck">図面と公式資料をたどり、<br className="lp-desktop-break" />競合を見る視点を整理する。</p>
          <div className="lp-hero-actions">
            <PrimaryLink />
            <a className="lp-text-link" href="#features">{copy.secondaryCta}<ArrowRightIcon size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
        <DrawingPreview />
      </section>

      <div className="lp-container lp-professionals">
        <span className="lp-eyebrow">FOR PROFESSIONALS</span>
        <p>商品企画 / デザイン / 知財 <span>のみなさまへ</span>
        </p>
      </div>

      <section className="lp-section lp-container" id="features" aria-labelledby="lp-features-heading">
        <div className="lp-section-heading">
          <p className="lp-eyebrow">THE QUESTION</p>
          <h2 id="lp-features-heading">情報はある。<br />次に見るべき点は、まだ見えない。</h2>
          <p className="lp-section-intro">新しい公報や製品情報を集めても、一覧と件数だけでは、企画の議論は進みにくいものです。<br className="lp-desktop-break" />KIRIKO Design Signalsは、意匠を起点に「どこを見るか」「何を確かめるか」をつなぎます。</p>
        </div>
        <div className="lp-three-columns lp-challenges">{copy.challenges.map((item) => <article className="lp-column" key={item.number}>
          <span className="lp-step-number">{item.number}</span>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
          <p className="lp-column-question">{item.question}</p>
        </article>)}</div>
      </section>

      <section className="lp-section lp-workflow lp-container" id="workflow" aria-labelledby="lp-workflow-heading">
        <div className="lp-section-heading">
          <p className="lp-eyebrow">FROM NOTICE TO EVIDENCE</p>
          <h2 id="lp-workflow-heading">気づきから、根拠へ。</h2>
          <p className="lp-section-intro">形を見比べ、記載を読み、残った問いを考える。<br />その行き来が、次の検討につながる視点をつくります。</p>
        </div>
        <div className="lp-three-columns">{copy.workflow.map((item) => <article className="lp-column lp-workflow-column" key={item.number}>
          <span className="lp-step-number">{item.number}</span>
          <h3>{item.title}</h3>
          <p className="lp-workflow-lead">{item.lead}</p>
          <p>{item.text}</p>
          <p className="lp-workflow-result">{item.result}</p>
        </article>)}</div>
        <a className="lp-text-link lp-workflow-link" href="#experience">架空のランプで、流れを体験する<ArrowRightIcon size={18} aria-hidden="true" />
        </a>
      </section>

      <section className="lp-experience-section" id="experience" aria-labelledby="lp-experience-heading">
        <div className="lp-container lp-experience-grid">
          <div className="lp-experience-copy">
            <p className="lp-eyebrow">TRY THE PERSPECTIVE</p>
            <h2 id="lp-experience-heading">ひとつの違いから、<br />検討を深める。</h2>
            <p>たとえば、二つのテーブルランプ。シェードの輪郭や部位のつながりに目を向けると、次に確かめたいことが生まれます。</p>
            <p>図面・資料・次の問いを切り替えながら、気づきから調査へ進む流れを体験してください。</p>
            <p className="lp-sample-note">{copy.sampleNote}</p>
          </div>
          <div className="lp-experience-workspace">
            <div className="lp-workspace-top">
              <div className="lp-tabs" role="tablist" aria-label="体験するステップ">
                {experienceTabs.map((tab, index) => (
                  <button
                    key={tab.id}
                    ref={(element) => { tabButtons.current[index] = element; }}
                    className="lp-tab"
                    id={`lp-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`lp-panel-${tab.id}`}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(event) => handleTabKey(event, index)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <span className="lp-workspace-sample">架空サンプル</span>
            </div>

            <div className="lp-tab-panel" id="lp-panel-drawings" role="tabpanel" tabIndex={0} aria-labelledby="lp-tab-drawings" hidden={activeTab !== 'drawings'}>
              <div className="lp-demo-drawings">
                <div className="lp-comparison-labels">
                  <span>比較 A 正面図</span>
                  <span>比較 B 正面図</span>
                </div>
                <img src={lampComparison} alt="比較Aのドーム型と比較Bの台形のシェードを並べた、架空のランプの正面図" width="1484" height="1060" loading="lazy" />
                <button className="lp-expand-button" type="button" onClick={openDrawing}>図面を大きく見る<ArrowUpRightIcon size={17} aria-hidden="true" />
                </button>
              </div>
              <div className="lp-focus-picker" aria-label="図面の注目点">
                {copy.focusPoints.map((point, index) => (
                  <button
                    className="lp-focus-button"
                    type="button"
                    aria-pressed={focusIndex === index}
                    key={point.label}
                    onClick={() => setFocusIndex(index)}
                  >
                    {point.label}
                  </button>
                ))}
              </div>
              <div className="lp-focus-description" aria-live="polite" aria-atomic="true">
                <p className="lp-eyebrow">注目する視点</p>
                <h3>{selectedFocus.title}</h3>
                <p>{selectedFocus.text}</p>
                <p className="lp-next-note">
                  <strong>次に確かめたいこと</strong>{selectedFocus.next}</p>
              </div>
            </div>

            <div className="lp-tab-panel lp-source-panel" id="lp-panel-sources" role="tabpanel" tabIndex={0} aria-labelledby="lp-tab-sources" hidden={activeTab !== 'sources'}>
              <p className="lp-eyebrow">CHECK THE SOURCE</p>
              <h3>その見方を、何で確かめる？</h3>
              <p className="lp-panel-intro">図面で気になった点を、別の図や公式資料から見直します。資料がない部分は、分からないまま残すことも検討の一部です。</p>
              <div className="lp-source-list">{copy.sources.map((source, index) => <article className="lp-source-row" key={source.title}>
                <span className="lp-source-number">0{index + 1}</span>
                <div>
                  <h4>{source.title}</h4>
                  <p>{source.text}</p>
                  <span className="lp-source-status">{source.status}</span>
                </div>
              </article>)}</div>
              <p className="lp-panel-footnote">この体験では実際の公式資料に接続しません。確認する資料と、確かめたい点の整理例を示しています。</p>
              <button className="lp-button lp-button-secondary" type="button" onClick={() => { setActiveTab('questions'); tabButtons.current[2]?.focus(); }}>次の問いへ進む<ArrowRightIcon size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="lp-tab-panel lp-question-panel" id="lp-panel-questions" role="tabpanel" tabIndex={0} aria-labelledby="lp-tab-questions" hidden={activeTab !== 'questions'}>
              <p className="lp-eyebrow">YOUR NEXT QUESTION</p>
              <h3>答えを急ぐ前に、問いをひとつ深く。</h3>
              <p className="lp-panel-intro">違いを見つけたことを結論にせず、確かめる対象と理由へつなげます。企画の議論に持ち込むなら、何を追加で知りたいでしょうか。</p>
              <div className="lp-question-list">{copy.nextQuestions.map((question, index) => <article key={question.title}>
                <span className="lp-step-number">0{index + 1}</span>
                <h4>{question.title}</h4>
                <p>{question.text}</p>
              </article>)}</div>
              <p className="lp-panel-footnote">上記は説明用の問いの例です。実在製品の性能・意図・戦略を示すものではありません。</p>
              <a className="lp-text-link" href="#use-cases">自分の仕事での使い方を考える<ArrowRightIcon size={18} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-section lp-container" id="use-cases" aria-labelledby="lp-use-cases-heading">
        <div className="lp-section-heading">
          <p className="lp-eyebrow">ONE SOURCE, DIFFERENT PERSPECTIVES</p>
          <h2 id="lp-use-cases-heading">同じ根拠を、<br />それぞれの視点で。</h2>
          <p className="lp-section-intro">同じ図面と出典を見ながら、立場に応じた問いを立てる。<br />調査担当者の気づきを、チームの検討材料へつなげます。</p>
        </div>
        <div className="lp-three-columns lp-use-cases">{copy.roles.map((role) => <article className="lp-column" key={role.title}>
          <h3>{role.title}</h3>
          <p className="lp-role-subtitle">{role.subtitle}</p>
          <p>{role.text}</p>
          <div className="lp-role-questions">
            <h4>検討の問いの例</h4>
            <ul>{role.questions.map((question) => <li key={question}>{question}</li>)}</ul>
          </div>
        </article>)}</div>
        <p className="lp-shared-message">答えを急ぐ前に、同じ図面と出典を見ながら話せること。<br />その土台を整えます。</p>
      </section>

      <section className="lp-section lp-container lp-faq-section" id="faq" aria-labelledby="lp-faq-heading">
        <div className="lp-section-heading">
          <p className="lp-eyebrow">FAQ</p>
          <h2 id="lp-faq-heading">検討を始める前に。</h2>
          <p>使い方と、このページで<br className="lp-desktop-break" />お伝えできる範囲について。</p>
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

      <section className="lp-final-cta" aria-labelledby="lp-final-heading">
        <div className="lp-container lp-final-inner">
          <div>
            <p className="lp-eyebrow">NEXT ACTION</p>
            <h2 id="lp-final-heading">次の会議に、<br className="lp-mobile-break" />ひとつ深い問いを。</h2>
            <p>何が変わったのか。なぜ気になるのか。<br />図面と公式資料をたどるところから、次の検討を始めませんか。</p>
          </div>
          <PrimaryLink />
        </div>
      </section>
    </main>

    <footer className="lp-footer lp-container">
      <div className="lp-footer-top">
        <Brand />
        <nav aria-label="フッターナビゲーション">
          <a href="#features">特徴</a>
          <a href="#workflow">使い方</a>
          <a href="#faq">よくあるご質問</a>
        </nav>
      </div>
      <div className="lp-footer-bottom">
        <p>図面は説明用の架空サンプルです。<span>KIRIKO Design Signals｜開発・検証中</span>
        </p>
        <p>© 2026 KIRIKO Design Signals</p>
      </div>
    </footer>

    <dialog ref={dialog} className="lp-drawing-dialog" aria-labelledby="lp-dialog-title" onClose={() => dialogOpener.current?.focus()}>
      <div className="lp-dialog-header">
        <div>
          <p className="lp-eyebrow">FICTIONAL DRAWING SAMPLE</p>
          <h2 id="lp-dialog-title">比較 A・Bの図面を見比べる</h2>
        </div>
        <button className="lp-button lp-button-secondary lp-dialog-close" type="button" onClick={() => dialog.current?.close()}>閉じる</button>
      </div>
      <p className="lp-dialog-note">{copy.sampleNote}</p>
      <div className="lp-zoom-controls" aria-label="図面の表示倍率">
        <span>表示倍率</span>{[100, 150, 200].map((value) => <button className="lp-zoom-button" type="button" aria-pressed={zoom === value} key={value} onClick={() => setZoom(value)}>{value}%</button>)}</div>
      <div className="lp-dialog-image-viewport" tabIndex={0} aria-label="拡大した図面。倍率が高い場合はスクロールできます。">
        <img className="lp-dialog-image" style={{ width: `${zoom}%` }} src={lampComparison} alt="左はドーム型、右は台形のシェードを持つ、架空のテーブルランプの比較図" width="1484" height="1060" />
      </div>
      <p className="lp-dialog-footnote">説明用の図のため、実寸・厳密な寸法比の比較はできません。</p>
    </dialog>
  </div>;
}
