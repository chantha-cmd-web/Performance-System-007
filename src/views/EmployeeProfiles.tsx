import { apiFetch } from '../mockApi';
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, Upload, Download, Trash2, Edit2, CheckCircle2, AlertCircle, X, FileText, FileSpreadsheet } from 'lucide-react';
import { Employee } from '../types';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

type ImportError = { row: number; id: string; message: string };

export default function EmployeeProfiles() {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'summary'>('idle');
  const [importSummary, setImportSummary] = useState({ total: 0, success: 0, failed: 0, errors: [] as ImportError[] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEmployees = async () => {
    try {
      const res = await apiFetch('/api/employees', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setEmployees(await res.json());
      }
    } catch (err) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [token]);

  const deleteEmployee = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    try {
      const res = await apiFetch(`/api/employees/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Employee deleted');
        fetchEmployees();
      } else {
        toast.error('Failed to delete');
      }
    } catch (err) {
      toast.error('Failed to delete employee');
    }
  };

  const handleResetAll = async () => {
    if (!confirm('Are you ABSOLUTELY sure you want to delete ALL employee profiles? This cannot be undone.')) return;
    try {
      const res = await apiFetch(`/api/employees/all`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('All employees deleted');
        fetchEmployees();
      } else {
        toast.error('Failed to delete all');
      }
    } catch (err) {
      toast.error('Failed to reset employees');
    }
  };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImportStatus('processing');
    setImportSummary({ total: 0, success: 0, failed: 0, errors: [] });
    
    const evalConditionMap: Record<string, string> = {
      '60-40 (Direct Supervisor 60% + Supporter 40%)': 'campus_60_40',
      '60–40 (Direct Supervisor 60% + Supporter 40%)': 'campus_60_40',
      '50-50 (Direct Supervisor 50% + Supporter 50%)': 'campus_50_50',
      '50–50 (Direct Supervisor 50% + Supporter 50%)': 'campus_50_50',
      '100% Campus (Direct Supervisor only)': 'campus_100',
      '100% Central (Central Office Supervisor only)': 'central_100',
      '100% Management (Management only)': 'mgmt_100'
    };

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        let successCount = 0;
        let failedCount = 0;
        const errors: ImportError[] = [];
        const existingIds = new Set(employees.map(emp => emp.id));
        const newIdsInImport = new Set();
        
        for (let i = 0; i < data.length; i++) {
          const row: any = data[i];
          const rowNum = i + 2;
          const staffId = String(row['Staff ID'] || '').trim();
          
          if (!staffId) {
            errors.push({ row: rowNum, id: 'Unknown', message: 'Staff ID is required' });
            failedCount++;
            continue;
          }
          
          if (newIdsInImport.has(staffId)) {
            errors.push({ row: rowNum, id: staffId, message: 'Duplicate Staff ID in spreadsheet' });
            failedCount++;
            continue;
          }
          
          if (!row['Employee Name']) {
            errors.push({ row: rowNum, id: staffId, message: 'Employee Name is required' });
            failedCount++;
            continue;
          }
          
          const rawCondition = String(row['Evaluation Condition'] || '').trim();
          let matchedModel = String(row['Evaluation Workflow'] || row['Evaluation Model'] || row['evalModel'] || '').trim();
          if (rawCondition && evalConditionMap[rawCondition]) {
            matchedModel = evalConditionMap[rawCondition];
          }

          let parsedRole = String(row['User Role'] || row['Role'] || row['role'] || 'user').trim().toLowerCase();
          if (!['superadmin', 'admin', 'user'].includes(parsedRole)) {
            parsedRole = 'user';
          }
          const parsedEmail = String(row['Email Address'] || row['Email'] || row['email'] || '').trim();

          const emp = {
            id: staffId,
            name: String(row['Employee Name'] || row['name'] || '').trim(),
            khmerName: String(row['Khmer Name'] || row['khmerName'] || '').trim(),
            email: parsedEmail,
            campus: String(row['Campus'] || row['campus'] || '').trim(),
            department: String(row['Department'] || row['department'] || '').trim(),
            position: String(row['Position'] || row['position'] || '').trim(),
            category: String(row['Category'] || row['category'] || '').trim(),
            supervisorId: String(row['Direct Supervisor'] || row['Direct Supervisor ID'] || row['supervisorId'] || '').trim(),
            supporterId: String(row['Supporter'] || row['Supporter ID'] || row['supporterId'] || '').trim(),
            managementId: String(row['Management Evaluator'] || row['Management Evaluator ID'] || '').trim(),
            evalCondition: rawCondition,
            evalModel: matchedModel,
            evalPeriod: String(row['Evaluation Period'] || row['evalPeriod'] || '').trim(),
            status: String(row['Status'] || '').trim() || 'Active',
            role: parsedRole,
          };

          try {
            const res = await apiFetch('/api/employees', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}` 
              },
              body: JSON.stringify(emp)
            });
            if (res.ok) {
              successCount++;
              newIdsInImport.add(staffId);
            } else {
              failedCount++;
              errors.push({ row: rowNum, id: staffId, message: 'Server failed to save record' });
            }
          } catch (err) {
            failedCount++;
            errors.push({ row: rowNum, id: staffId, message: 'Network error during save' });
          }
        }
        
        setImportSummary({
          total: data.length,
          success: successCount,
          failed: failedCount,
          errors
        });
        setImportStatus('summary');
        fetchEmployees();
      } catch (err) {
        toast.error('Failed to process file. Ensure it is a valid Excel format.');
        setImportStatus('idle');
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = () => {
    const data = employees.map(e => ({
      'Staff ID': e.id,
      'Employee Name': e.name,
      'Khmer Name': e.khmerName || '',
      'Email Address': e.email || '',
      'Campus': e.campus,
      'Department': e.department || '',
      'Position': e.position,
      'Category': e.category || '',
      'Direct Supervisor ID': e.supervisorId || '',
      'Supporter ID': e.supporterId || '',
      'Evaluation Model': e.evalModel || '',
      'Evaluation Period': e.evalPeriod || '',
      'Status': e.status || 'Active',
      'User Role': e.role || 'user'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "employees_export.xlsx");
  };

  const handleDownloadTemplate = () => {
    const data = [{
      'Staff ID': 'EMP001',
      'Employee Name': 'John Doe',
      'Khmer Name': 'សុខ សាន្ត',
      'Email Address': 'johndoe@example.com',
      'Campus': 'Main Campus',
      'Department': 'IT',
      'Position': 'Developer',
      'Category': 'Full-time',
      'Direct Supervisor': 'SUP001',
      'Supporter': 'SUP002',
      'Management Evaluator': '',
      'Evaluation Condition': '60-40 (Direct Supervisor 60% + Supporter 40%)',
      'Evaluation Workflow': 'campus_60_40',
      'Evaluation Period': 'Q3 2026',
      'Status': 'Active',
      'User Role': 'user'
    }];
    const ws = XLSX.utils.json_to_sheet(data);
    // Add column widths
    ws['!cols'] = [
      { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, 
      { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, 
      { wch: 15 }, { wch: 20 }, { wch: 45 }, { wch: 20 },
      { wch: 18 }, { wch: 10 }, { wch: 12 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "employee_import_template.xlsx");
  };

  const filteredEmployees = employees.filter(e => 
    e.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.khmerName && e.khmerName.includes(searchTerm)) ||
    (e.department && e.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight flex flex-wrap items-center gap-x-2">
            <span>Employee Profiles</span>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="font-medium text-base sm:text-lg text-slate-500">ប្រវត្តិរូបបុគ្គលិក</span>
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">Manage all {employees.length} employee records</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button onClick={handleExport} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 font-semibold shadow-sm text-xs sm:text-sm">
            <Download size={16} /> Export
          </button>
          {user?.role === 'superadmin' && (
            <>
              <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 font-semibold shadow-sm text-xs sm:text-sm">
                <Upload size={16} /> Bulk Import
              </button>
              <button onClick={handleResetAll} className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 font-semibold shadow-sm text-xs sm:text-sm">
                <Trash2 size={16} /> Reset All
              </button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text"
            placeholder="Search by Staff ID, Name, Department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 font-bold sticky top-0 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Staff ID</th>
                <th className="px-6 py-4">Name / ឈ្មោះ</th>
                <th className="px-6 py-4">Campus / Department</th>
                <th className="px-6 py-4">Position</th>
                <th className="px-6 py-4">Supervisor / Supporter</th>
                {user?.role === 'superadmin' && <th className="px-6 py-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={6} className="text-center p-8">Loading...</td></tr>
              ) : filteredEmployees.length === 0 ? (
                <tr><td colSpan={6} className="text-center p-8">No employees found</td></tr>
              ) : (
                filteredEmployees.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-6 py-4 font-bold text-indigo-600 dark:text-indigo-400">{e.id}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{e.name}</div>
                      <div className="text-xs text-slate-500">{e.khmerName}</div>
                      {e.email && <div className="text-xs text-slate-400 mt-1">{e.email}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div>{e.campus}</div>
                      <div className="text-xs text-slate-500">{e.department}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{e.position}</div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold mt-1.5 ${
                        e.role === 'superadmin' ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400' :
                        e.role === 'admin' ? 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400' :
                        'bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-400'
                      }`}>
                        {e.role || 'user'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div>Sup: {e.supervisorId || 'N/A'}</div>
                      <div>Sup2: {e.supporterId || 'N/A'}</div>
                    </td>
                    {user?.role === 'superadmin' && (
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => deleteEmployee(e.id)} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isImportModalOpen && (
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
      )}
    </div>
  );
}
