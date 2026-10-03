import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import MenuRateOverrides, { inheritedRates } from '../../src/features/production/components/MenuRateOverrides';
import '../../src/features/production/layout/production.css';

function Fixture() {
  const [rates, setRates] = useState(inheritedRates);
  return <main style={{ maxWidth: 960, padding: 20, fontFamily: 'Arial, sans-serif', margin: '0 auto' }}>
    <h1 style={{ fontSize: 24 }}>Menu pricing controls test</h1>
    <MenuRateOverrides value={rates} onChange={setRates} />
    <output aria-label="Saved rates" style={{ display: 'block', marginTop: 24, overflowWrap: 'anywhere' }}>{JSON.stringify(rates)}</output>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
