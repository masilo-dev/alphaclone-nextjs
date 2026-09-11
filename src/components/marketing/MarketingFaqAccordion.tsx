'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/marketing/ui/accordion';

type FaqItem = {
  question: string;
  answer: string;
};

type MarketingFaqAccordionProps = {
  items: FaqItem[];
};

export default function MarketingFaqAccordion({ items }: MarketingFaqAccordionProps) {
  return (
    <Accordion type="single" collapsible className="space-y-3">
      {items.map((item, index) => (
        <AccordionItem key={item.question} value={`item-${index}`}>
          <AccordionTrigger>{item.question}</AccordionTrigger>
          <AccordionContent>{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
