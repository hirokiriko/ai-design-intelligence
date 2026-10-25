import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowUpRightIcon, CopyIcon } from '@phosphor-icons/react';
import { landingContent } from './content';

const copy = landingContent.contact;

type ContactValues = {
  company: string;
  name: string;
  email: string;
  scope: string;
  pain: string;
  message: string;
};

const initialValues: ContactValues = {
  company: '',
  name: '',
  email: '',
  scope: '',
  pain: '',
  message: '',
};

function buildMessage(values: ContactValues) {
  return [
    'Design Signalsの活用について相談します。',
    '',
    `${copy.fields.company}：${values.company.trim()}`,
    `${copy.fields.name}：${values.name.trim()}`,
    `${copy.fields.email}：${values.email.trim()}`,
    `${copy.fields.scope}：${values.scope.trim() || '未記入'}`,
    `${copy.fields.pain}：${values.pain || '未選択'}`,
    '',
    `${copy.fields.message}：`,
    values.message.trim(),
  ].join('\r\n');
}

export default function ContactSection() {
  const [values, setValues] = useState<ContactValues>(initialValues);
  const [prepared, setPrepared] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  const messagePreview = useRef<HTMLTextAreaElement>(null);
  const preparedMessage = buildMessage(values);
  const mailtoHref = `mailto:${copy.email}?subject=${encodeURIComponent(copy.emailSubject)}&body=${encodeURIComponent(preparedMessage)}`;

  const updateValue = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const field = event.currentTarget.name as keyof ContactValues;
    const value = event.currentTarget.value;
    setValues((current) => ({ ...current, [field]: value }));
    setPrepared(false);
    setCopyStatus('idle');
  };

  const prepareMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPrepared(true);
    setCopyStatus('idle');
  };

  const copyMessage = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(preparedMessage);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('manual');
      messagePreview.current?.focus();
      messagePreview.current?.select();
    }
  };

  return (
    <section className="lp-contact-section" id="contact" aria-labelledby="lp-contact-heading">
      <div className="lp-contact-container lp-container">
        <div className="lp-contact-intro">
          <p className="lp-contact-eyebrow lp-eyebrow">活用についてのご相談</p>
          <h2 id="lp-contact-heading">{copy.heading}</h2>
          <p className="lp-contact-description">{copy.intro}</p>
          <div className="lp-contact-destination">
            <span className="lp-contact-destination-label">お問い合わせ先</span>
            <a href={`mailto:${copy.email}`}>{copy.email}</a>
          </div>
        </div>

        <form className="lp-contact-form" onSubmit={prepareMessage}>
          <p className="lp-contact-required-note">「必須」の項目をご入力ください。</p>
          <div className="lp-contact-fields">
            <div className="lp-contact-field">
              <label htmlFor="lp-contact-company">{copy.fields.company}<span className="lp-contact-required">必須</span></label>
              <input
                id="lp-contact-company"
                name="company"
                type="text"
                autoComplete="organization"
                placeholder={copy.placeholders.company}
                value={values.company}
                onChange={updateValue}
                required
              />
            </div>
            <div className="lp-contact-field">
              <label htmlFor="lp-contact-name">{copy.fields.name}<span className="lp-contact-required">必須</span></label>
              <input
                id="lp-contact-name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder={copy.placeholders.name}
                value={values.name}
                onChange={updateValue}
                required
              />
            </div>
            <div className="lp-contact-field lp-contact-field-full">
              <label htmlFor="lp-contact-email">{copy.fields.email}<span className="lp-contact-required">必須</span></label>
              <input
                id="lp-contact-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder={copy.placeholders.email}
                value={values.email}
                onChange={updateValue}
                required
              />
            </div>
            <div className="lp-contact-field lp-contact-field-full">
              <label htmlFor="lp-contact-scope">{copy.fields.scope}<span className="lp-contact-optional">任意</span></label>
              <input
                id="lp-contact-scope"
                name="scope"
                type="text"
                placeholder={copy.placeholders.scope}
                value={values.scope}
                onChange={updateValue}
              />
            </div>
            <div className="lp-contact-field lp-contact-field-full">
              <label htmlFor="lp-contact-pain">{copy.fields.pain}<span className="lp-contact-optional">任意</span></label>
              <select id="lp-contact-pain" name="pain" value={values.pain} onChange={updateValue}>
                <option value="">選択してください</option>
                {copy.painOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
            <div className="lp-contact-field lp-contact-field-full">
              <label htmlFor="lp-contact-message">{copy.fields.message}<span className="lp-contact-required">必須</span></label>
              <textarea
                id="lp-contact-message"
                name="message"
                rows={6}
                placeholder={copy.placeholders.message}
                value={values.message}
                onChange={updateValue}
                required
              />
            </div>
          </div>

          <p className="lp-contact-privacy">{copy.privacyNote}</p>
          <button className="lp-contact-prepare lp-button lp-button-primary" type="submit">相談内容を確認する<ArrowUpRightIcon size={18} aria-hidden="true" /></button>

          {prepared && (
            <div className="lp-contact-prepared" aria-labelledby="lp-contact-prepared-heading">
              <h3 id="lp-contact-prepared-heading">メールで送る内容</h3>
              <p className="lp-contact-ready" id="lp-contact-ready" role="status">{copy.readyMessage}</p>
              <label className="lp-contact-preview-label" htmlFor="lp-contact-message-preview">メール本文</label>
              <textarea
                ref={messagePreview}
                className="lp-contact-preview"
                id="lp-contact-message-preview"
                rows={10}
                value={preparedMessage}
                readOnly
                aria-describedby={copyStatus === 'manual' ? 'lp-contact-copy-status' : undefined}
              />
              <div className="lp-contact-delivery-actions">
                <a
                  className="lp-contact-mail-link lp-button lp-button-primary"
                  href={mailtoHref}
                  aria-describedby="lp-contact-delivery-note lp-contact-ready"
                >
                  {copy.submitLabel}<ArrowUpRightIcon size={18} aria-hidden="true" />
                </a>
                <button className="lp-contact-copy-button lp-button lp-button-secondary" type="button" onClick={copyMessage}>
                  <CopyIcon size={18} aria-hidden="true" />{copy.copyLabel}
                </button>
              </div>
              <p className="lp-contact-delivery-note" id="lp-contact-delivery-note">{copy.deliveryNote}</p>
              {copyStatus !== 'idle' && (
                <p className="lp-contact-copy-status" id="lp-contact-copy-status" role="status">
                  {copyStatus === 'copied' ? copy.copySuccess : copy.copyError}
                </p>
              )}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
