import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Search, Plus, Upload, Download, Trash2, Edit2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Employee } from '../types';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export default function EmployeeProfiles() {
  const { token, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees', {
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
      const res = await fetch(`/api/employees/${id}`, {
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        let successCount = 0;
        let errorCount = 0;

        // Process sequentially to not overwhelm server, could be batched in real app
        for (const row of data as any[]) {
          const emp = {
            id: String(row['Staff ID'] || row['id'] || ''),
            name: String(row['Employee Name'] || row['name'] || ''),
            khmerName: String(row['Khmer Name'] || row['khmerName'] || ''),
            campus: String(row['Campus'] || row['campus'] || ''),
            department: String(row['Department'] || row['department'] || ''),
            position: String(row['Position'] || row['position'] || ''),
            category: String(row['Category'] || row['category'] || ''),
            supervisorId: String(row['Direct Supervisor ID'] || row['supervisorId'] || ''),
            supporterId: String(row['Supporter ID'] || row['supporterId'] || ''),
            evalModel: String(row['Evaluation Model'] || row['evalModel'] || ''),
            evalPeriod: String(row['Evaluation Period'] || row['evalPeriod'] || ''),
          };

          if (!emp.id || !emp.name) {
            errorCount++;
            continue;
          }

          try {
            const res = await fetch('/api/employees', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}` 
              },
              body: JSON.stringify(emp)
            });
            if (res.ok) successCount++;
            else errorCount++;
          } catch (err) {
            errorCount++;
          }
        }
        
        toast.success(`Import complete! ${successCount} imported, ${errorCount} failed.`);
        setIsImportModalOpen(false);
        fetchEmployees();
        
      } catch (err) {
        toast.error('Failed to process file');
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
      'Campus': e.campus,
      'Department': e.department || '',
      'Position': e.position,
      'Category': e.category || '',
      'Direct Supervisor ID': e.supervisorId || '',
      'Supporter ID': e.supporterId || '',
      'Evaluation Model': e.evalModel || '',
      'Evaluation Period': e.evalPeriod || ''
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
      'Campus': 'Main Campus',
      'Department': 'IT',
      'Position': 'Developer',
      'Category': 'Full-time',
      'Direct Supervisor ID': 'SUP001',
      'Supporter ID': '',
      'Evaluation Model': 'campus_60_40',
      'Evaluation Period': 'Q3 2026'
    }];
    const ws = XLSX.utils.json_to_sheet(data);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">Employee Profiles / <span className="font-medium text-lg text-slate-500">ប្រវត្តិរូបបុគ្គលិក</span></h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Manage all {employees.length} employee records</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 font-semibold shadow-sm">
            <Download size={18} /> Export
          </button>
          {user?.role === 'superadmin' && (
            <>
              <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-500/20 font-semibold shadow-sm">
                <Upload size={18} /> Bulk Import
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
                      <div className="text-xs">{e.khmerName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{e.campus}</div>
                      <div className="text-xs text-slate-500">{e.department}</div>
                    </td>
                    <td className="px-6 py-4">{e.position}</td>
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
      )}
    </div>
  );
}
