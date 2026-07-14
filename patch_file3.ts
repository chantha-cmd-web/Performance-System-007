import fs from 'fs';

let content = fs.readFileSync('src/views/EmployeeProfiles.tsx', 'utf-8');

const targetStr = `      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Bulk Import Employees</h2>
              <p className="text-sm text-slate-500 mt-1">Upload an Excel or CSV file to import employees.</p>
            </div>
            <div className="p-6 space-y-6">
              <button onClick={handleDownloadTemplate} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                <Download size={18} /> Download Template
              </button>
              
              <div className="relative">
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                />
                <div className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors">
                  <Upload size={18} /> Select File to Import
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 rounded-lg font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">Close</button>
            </div>
          </div>
        </div>
      )}`;

const newStr = `      {isImportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Bulk Import Employees</h2>
                <p className="text-sm text-slate-500 mt-1">Upload an Excel or CSV file to import employees and assign evaluation workflows.</p>
              </div>
              {importStatus !== 'processing' && (
                <button onClick={() => { setIsImportModalOpen(false); setImportStatus('idle'); }} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X size={20} />
                </button>
              )}
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto min-h-[300px]">
              {importStatus === 'idle' && (
                <div className="space-y-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50 flex gap-4">
                    <FileSpreadsheet className="text-blue-500 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-blue-800 dark:text-blue-300">Data Format Requirements</h4>
                      <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        Ensure all required fields like Staff ID and Employee Name are present. 
                        Use the standard evaluation condition values (e.g., "60-40 (Direct Supervisor 60% + Supporter 40%)") 
                        to automatically map to the correct workflow.
                      </p>
                    </div>
                  </div>
                  
                  <button onClick={handleDownloadTemplate} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                    <Download size={18} /> Download Excel Template
                  </button>
                  
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    />
                    <div className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors shadow-sm">
                      <Upload size={20} /> Browse & Select File to Import
                    </div>
                  </div>
                </div>
              )}
              
              {importStatus === 'processing' && (
                <div className="h-full flex flex-col items-center justify-center space-y-4 py-12">
                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Processing Data...</h3>
                  <p className="text-slate-500">Please wait while we validate and import your records.</p>
                </div>
              )}
              
              {importStatus === 'summary' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                      <div className="text-3xl font-black text-slate-800 dark:text-slate-100">{importSummary.total}</div>
                      <div className="text-sm font-medium text-slate-500 uppercase tracking-wider mt-1">Total Rows</div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 text-center">
                      <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{importSummary.success}</div>
                      <div className="text-sm font-medium text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mt-1">Successful</div>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-200 dark:border-red-900/50 text-center">
                      <div className="text-3xl font-black text-red-600 dark:text-red-400">{importSummary.failed}</div>
                      <div className="text-sm font-medium text-red-600 dark:text-red-500 uppercase tracking-wider mt-1">Failed</div>
                    </div>
                  </div>
                  
                  {importSummary.errors.length > 0 && (
                    <div className="mt-6">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">Validation Errors</h3>
                      <div className="border border-red-200 dark:border-red-900/50 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                          <thead className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold">
                            <tr>
                              <th className="px-4 py-2">Row</th>
                              <th className="px-4 py-2">Staff ID</th>
                              <th className="px-4 py-2">Error Message</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-100 dark:divide-red-900/30">
                            {importSummary.errors.map((err, idx) => (
                              <tr key={idx} className="bg-white dark:bg-slate-800">
                                <td className="px-4 py-2 font-medium">{err.row}</td>
                                <td className="px-4 py-2">{err.id}</td>
                                <td className="px-4 py-2 text-red-600 dark:text-red-400">{err.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {importStatus === 'summary' && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                <button onClick={() => setImportStatus('idle')} className="px-4 py-2 rounded-xl font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20">
                  Import Another File
                </button>
                <button onClick={() => { setIsImportModalOpen(false); setImportStatus('idle'); }} className="px-4 py-2 rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-700">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}`;

content = content.replace(targetStr, newStr);
fs.writeFileSync('src/views/EmployeeProfiles.tsx', content);
