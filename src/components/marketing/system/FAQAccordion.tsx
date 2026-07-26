'use client';

import { useId, useState } from 'react';

export type FaqItem = {
  question: string;
  answer: string;
  id?: string;
};

export default function FAQAccordion({ items }: { items: FaqItem[] }) {
  const baseId = useId();
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? `${baseId}-0`);

  return (
    <div className="mkt-faq-grid">
      {items.map((item, index) => {
        const panelId = item.id ?? `${baseId}-${index}`;
        const buttonId = `${panelId}-trigger`;
        const isOpen = openId === panelId;

        return (
          <div key={panelId} className="mkt-faq" id={panelId}>
            <button
              id={buttonId}
              type="button"
              className="mkt-faq-trigger"
              aria-expanded={isOpen}
              aria-controls={`${panelId}-panel`}
              onClick={() => setOpenId((current) => (current === panelId ? null : panelId))}
            >
              <span>{item.question}</span>
              <span className="mkt-faq-plus" aria-hidden="true">
                {isOpen ? '−' : '+'}
              </span>
            </button>
            {isOpen ? (
              <div
                id={`${panelId}-panel`}
                role="region"
                aria-labelledby={buttonId}
                className="mkt-faq-panel"
              >
                {item.answer}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
