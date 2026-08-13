'use client';

import { useState } from 'react';
import Markdown from 'react-markdown';
import type { ValidationDocumentSummary } from '@/lib/data';

interface Props {
  documents: ValidationDocumentSummary[];
  // Pre-fetched server-side (docs are small, a few KB each) so expanding is instant and
  // doesn't need a client-side fetch — id -> content, or null if the file wasn't found on
  // disk (e.g. a generator hasn't been run yet).
  contentById: Record<string, string | null>;
}

function groupByWorkstream(documents: ValidationDocumentSummary[]) {
  const groups = new Map<string, ValidationDocumentSummary[]>();
  for (const doc of documents) {
    if (!groups.has(doc.workstream)) groups.set(doc.workstream, []);
    groups.get(doc.workstream)!.push(doc);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function EvidenceDocumentList({ documents, contentById }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const groups = groupByWorkstream(documents);

  return (
    <div className="space-y-6">
      {groups.map(([workstream, docs]) => (
        <div key={workstream}>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">{workstream}</p>
          <div className="space-y-2">
            {docs.map((doc) => {
              const isOpen = openId === doc.id;
              const content = contentById[doc.id];
              return (
                <div key={doc.id} className="bg-[#111827] border border-[#1e2d40] rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenId(isOpen ? null : doc.id)}
                    className="w-full text-left p-4 flex items-start justify-between gap-4 hover:bg-white/[0.02]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{doc.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{doc.summary}</p>
                    </div>
                    <span className="text-slate-500 text-xs shrink-0 mt-0.5">{isOpen ? '▲ collapse' : '▼ view'}</span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-[#1e2d40] p-5 prose prose-invert prose-sm max-w-none prose-headings:text-white prose-a:text-blue-400 prose-code:text-emerald-300 prose-table:text-xs">
                      {content ? (
                        <Markdown>{content}</Markdown>
                      ) : (
                        <p className="text-slate-500 text-sm">
                          Not generated yet — run the corresponding <code>pnpm</code> script to produce this document.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
