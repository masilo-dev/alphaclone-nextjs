import { Suspense } from 'react';
import BookDemoContent from './BookDemoContent';

export default function BookDemoPage() {
  return (
    <Suspense>
      <BookDemoContent />
    </Suspense>
  );
}
