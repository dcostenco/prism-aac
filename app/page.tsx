import PrismApp from '@/components/PrismApp';

// AAC shell pulls Pyodide via MathPanel → MathTutorTool. Even with
// next/dynamic({ssr:false}) the worker's import('pyodide') leaves
// pyodide.mjs in the server bundle (its top-level node:fs/node:path
// imports then crash prerender). The shell is fully client-driven, so
// skipping SSG here costs nothing — first paint still streams fast.
export const dynamic = 'force-dynamic';

export default function Home() {
  return <PrismApp />;
}
