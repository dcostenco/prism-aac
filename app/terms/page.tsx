import { readFile } from 'node:fs/promises';
import path from 'node:path';
import TermsDocument from '@/components/TermsDocument';
import TermsBackLink from '@/components/TermsBackLink';

export default async function TermsPage() {
  const source = await readFile(path.join(process.cwd(), 'TERMS.md'), 'utf8');
  return (
    <main lang="en" data-testid="terms-scroll" className="h-dvh min-h-0 w-full overflow-y-auto overscroll-y-contain bg-white px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto mb-6 w-full max-w-4xl">
        <TermsBackLink />
      </div>
      <TermsDocument source={source} />
    </main>
  );
}
