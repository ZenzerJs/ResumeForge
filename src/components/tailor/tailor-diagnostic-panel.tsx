import React, { useState } from 'react';
import { ResumeDiagnosticReport } from '@/lib/schema/resumeFeedback';
import { applyDeterministicPatch } from '@/lib/diagnostics/deterministicPatcher';

export const TailorDiagnosticPanel = ({ report }: { report?: ResumeDiagnosticReport }) => {
  const [patchResult, setPatchResult] = useState<string | null>(null);

  if (!report) return <div>No diagnostics</div>;

  const handleApplyFix = (diagnosticId: string) => {
    // Simulated available evidence and target bullet for offline patching
    const availableEvidence = [{ id: diagnosticId, content: "Patched content", extractedTechnologies: [] }];
    const typstAst = `// RF_BULLET:target-1\n- Old bullet\n`;
    try {
      const result = applyDeterministicPatch(typstAst, diagnosticId, "target-1", availableEvidence);
      setPatchResult(result.patchedTypstAst);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border rounded">
      <h3 className="font-bold">Diagnostics ({report.overallScore}%)</h3>
      
      {patchResult && <div className="text-xs text-green-500">Patched successfully!</div>}
      
      <div className="space-y-2">
        {report.items.map((item, index) => (
          <div key={item.id} className="p-2 border rounded cursor-pointer hover:bg-gray-50">
            <div className="flex justify-between items-center">
              <span className={`px-2 py-1 text-xs rounded ${item.severity === 'urgent' ? 'bg-red-100 text-red-800' : item.severity === 'non_urgent' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                {item.severity}
              </span>
              <span className="text-sm font-medium">{item.category}</span>
            </div>
            <p className="text-sm mt-1">{item.message}</p>
            <button 
              data-testid={`apply-diagnostic-fix-${index}`} 
              onClick={() => handleApplyFix(item.id)}
              className="text-xs text-blue-500 mt-2 hover:underline"
            >
              Apply Fix
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
