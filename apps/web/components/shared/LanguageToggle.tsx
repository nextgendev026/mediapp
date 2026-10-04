'use client';

import { Check, Globe2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function LanguageToggle() {
  const [language, setLanguage] = useState<'en' | 'sw'>('en');

  useEffect(() => {
    const saved = window.localStorage.getItem('afya-language');
    if (saved === 'en' || saved === 'sw') setLanguage(saved);
  }, []);

  function choose(next: 'en' | 'sw') {
    setLanguage(next);
    window.localStorage.setItem('afya-language', next);
    document.documentElement.lang = next;
  }

  return (
    <div className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-[var(--color-gray-200)] bg-white p-1" aria-label="Language selection">
      <Globe2 className="ml-2 h-4 w-4 text-[var(--color-gray-500)]" aria-hidden="true" />
      {(['en', 'sw'] as const).map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => choose(value)}
          className={`inline-flex min-h-9 items-center gap-1 rounded-md px-2.5 text-xs font-bold uppercase transition ${language === value ? 'bg-[var(--color-primary-light)] text-[var(--color-primary-dark)]' : 'text-[var(--color-gray-500)] hover:bg-[var(--color-gray-100)]'}`}
          aria-pressed={language === value}
        >
          {language === value && <Check className="h-3 w-3" aria-hidden="true" />}
          {value}
        </button>
      ))}
    </div>
  );
}
