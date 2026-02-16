'use client';


interface GrowthNarrativeProps {
  currentSnippet: string | null;
  firstReflection: { text: string; date: string } | null;
}

export default function GrowthNarrative({ currentSnippet, firstReflection }: GrowthNarrativeProps) {
  const showContrast = currentSnippet && firstReflection;

  const firstDate = firstReflection
    ? new Date(firstReflection.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100/60 rounded-2xl p-5 mb-5">
      <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider mb-2">
        Where you are
      </p>
      <p className="text-sm text-gray-800 leading-relaxed">
        {currentSnippet || 'Will appear after your first session.'}
      </p>

      {showContrast && (
        <>
          <div className="border-t border-indigo-200/40 my-3" />
          <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5">
            After your first session · {firstDate}
          </p>
          <p className="text-sm text-gray-500 leading-relaxed">
            {firstReflection.text}
          </p>
        </>
      )}
    </div>
  );
}
