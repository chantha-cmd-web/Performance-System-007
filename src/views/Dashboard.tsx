import { apiFetch } from '../mockApi';
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate, Link } from 'react-router-dom';
import { Evaluation, STATUS_LABELS } from '../types';
import { 
  Users, 
  TrendingUp, 
  Award, 
  AlertTriangle, 
  FileSpreadsheet, 
  Printer, 
  Download, 
  BarChart2, 
  Search, 
  RefreshCw, 
  X, 
  Plus, 
  Trash2, 
  CheckCircle, 
  Send, 
  FileJson, 
  Upload, 
  ChevronLeft, 
  ChevronRight, 
  HelpCircle, 
  Eye, 
  Edit2, 
  ShieldAlert,
  ArrowUpDown,
  Filter,
  Check,
  Calendar,
  Building,
  Bell,
  Sun,
  Moon,
  LogOut,
  Sparkles,
  Layers
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import * as xlsx from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { token, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Advanced search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCampus, setFilterCampus] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('');
  const [filterRating, setFilterRating] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');

  // Interactive sorting
  const [sortField, setSortField] = useState<keyof Evaluation | 'rating'>('overallScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importType, setImportType] = useState<'json' | 'excel'>('json');
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchEvals();
  }, []);

  const fetchEvals = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/evaluations', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setEvals(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load performance evaluations');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
    }
    
    setTimeout(() => {
      window.print();
      if (isDark) {
        document.documentElement.classList.add('dark');
      }
    }, 150);
  };

  // Score Badge calculation helpers
  const getSelfScore = (e: Evaluation) => e.totalSelf ?? 0;
  const getSuperScore = (e: Evaluation) => e.totalSuper ?? 0;
  
  const getSupporterScore = (e: Evaluation) => {
    if (e.criteriaScores && e.criteriaScores.length > 0) {
      const valid = e.criteriaScores.filter(c => c.supporterScore !== undefined);
      if (valid.length > 0) {
        return valid.reduce((sum, c) => sum + (c.supporterScore || 0), 0) / valid.length;
      }
    }
    return e.totalSuper ? Math.max(0, Math.min(100, e.totalSuper * 0.96 - 1)) : 0;
  };

  const getManagementScore = (e: Evaluation) => {
    if (e.criteriaScores && e.criteriaScores.length > 0) {
      const valid = e.criteriaScores.filter(c => c.managementScore !== undefined);
      if (valid.length > 0) {
        return valid.reduce((sum, c) => sum + (c.managementScore || 0), 0) / valid.length;
      }
    }
    return e.overallScore ? Math.max(0, Math.min(100, e.overallScore * 0.98)) : 0;
  };

  // Enhanced search and filter logic
  const filteredEvals = useMemo(() => {
    return evals.filter(e => {
      const matchesSearch = 
        e.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) || 
        e.employeeId.includes(searchQuery) ||
        (e.position && e.position.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.department && e.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        e.campus.toLowerCase().includes(searchQuery.toLowerCase());
        
      const matchesCampus = filterCampus ? e.campus === filterCampus : true;
      const matchesPeriod = filterPeriod ? e.reviewDate.startsWith(filterPeriod) : true;
      const matchesStatus = filterStatus ? e.status === filterStatus : true;
      
      let matchesRating = true;
      if (filterRating) {
        const r = getRating(e.overallScore).label;
        matchesRating = r === filterRating;
      }

      return matchesSearch && matchesCampus && matchesPeriod && matchesStatus && matchesRating;
    });
  }, [evals, searchQuery, filterCampus, filterPeriod, filterStatus, filterRating]);

  // Enhanced sorting logic
  const sortedEvals = useMemo(() => {
    const sorted = [...filteredEvals];
    sorted.sort((a, b) => {
      let aVal: any = a[sortField as keyof Evaluation] ?? '';
      let bVal: any = b[sortField as keyof Evaluation] ?? '';

      if (sortField === 'rating') {
        aVal = getRating(a.overallScore).label;
        bVal = getRating(b.overallScore).label;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      } else {
        return sortOrder === 'asc' 
          ? (aVal as number) - (bVal as number) 
          : (bVal as number) - (aVal as number);
      }
    });
    return sorted;
  }, [filteredEvals, sortField, sortOrder]);

  // Paginated Evaluations
  const paginatedEvals = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedEvals.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedEvals, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedEvals.length / itemsPerPage);

  const campuses = useMemo(() => Array.from(new Set(evals.map(e => e.campus))), [evals]);
  const periods = useMemo(() => Array.from(new Set(evals.map(e => e.reviewDate.substring(0, 7)))), [evals]);

  // Excel exporter
  const handleExportExcel = () => {
    if (filteredEvals.length === 0) {
      toast.error('No evaluation records available to export.');
      return;
    }

    const exportData = filteredEvals.map(e => {
      const rating = getRating(e.overallScore);
      const statusLabel = e.status ? (STATUS_LABELS[e.status]?.kh || e.status) : 'ព្រាង';
      return {
        'លេខសម្គាល់បុគ្គលិក / Employee ID': e.employeeId,
        'ឈ្មោះបុគ្គលិក / Employee Name': e.employeeName,
        'សាខា / Campus': e.campus,
        'តួនាទី / Position': e.position,
        'ប្រភេទការវាយតម្លៃ / Evaluation Type': e.evaluationType,
        'កាលបរិច្ឆេទ / Review Date': e.reviewDate,
        'ពិន្ទុខ្លួនឯង / Self Score': e.totalSelf,
        'អ្នកគ្រប់គ្រងវាយតម្លៃ / Supervisor Score': e.totalSuper,
        'ពិន្ទុសរុប / Final Score': e.overallScore.toFixed(1),
        'ចំណាត់ថ្នាក់ / Rating': `${rating.khLabel} (${rating.label})`,
        'មតិយោបល់ / Comments': e.evaluatorComments || '',
        'ស្ថានភាពអនុម័ត / Approval Status': statusLabel,
        'អ្នកវាយតម្លៃ / Evaluator': e.createdByName,
        'កាលបរិច្ឆេទបង្កើត / Created At': e.createdAt ? format(new Date(e.createdAt), 'yyyy-MM-dd HH:mm') : ''
      };
    });

    const worksheet = xlsx.utils.json_to_sheet(exportData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Evaluations');
    
    const wscols = Object.keys(exportData[0] || {}).map(key => ({ wch: Math.max(key.length, 20) }));
    worksheet['!cols'] = wscols;

    xlsx.writeFile(workbook, `Appraisal_Report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Successfully exported appraisal records to Excel!');
  };

  // JSON exporter
  const handleExportJSON = () => {
    if (filteredEvals.length === 0) {
      toast.error('No evaluation records available to export.');
      return;
    }
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredEvals, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Appraisal_Report_${format(new Date(), 'yyyy-MM-dd')}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success('Successfully exported appraisal records to JSON!');
  };

  // Bulk simulated Telegram Dispatch
  const handleBulkTelegram = async () => {
    const targets = selectedIds.length > 0 ? selectedIds : filteredEvals.map(e => String(e.id));
    if (targets.length === 0) {
      toast.error('Please select at least one evaluation report.');
      return;
    }

    const tId = toast.loading(`Dispatching ${targets.length} performance reports to Telegram groups...`);
    await new Promise(resolve => setTimeout(resolve, 1400));
    toast.dismiss(tId);
    toast.success(`Successfully dispatched ${targets.length} appraisals to the HR Executive Telegram channel!`, {
      icon: '⚡',
      duration: 3500
    });
  };

  // Bulk Approve action
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    const tId = toast.loading(`Approving ${selectedIds.length} evaluations...`);
    try {
      for (const id of selectedIds) {
        await apiFetch(`/api/evaluations/${id}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({ status: 'Approved' })
        });
      }
      toast.dismiss(tId);
      toast.success(`Successfully approved ${selectedIds.length} evaluations!`);
      setSelectedIds([]);
      fetchEvals();
    } catch (e) {
      toast.dismiss(tId);
      toast.error('Failed to complete bulk approval');
    }
  };

  // Bulk Delete action
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete these ${selectedIds.length} evaluation records?`)) return;
    
    const tId = toast.loading(`Deleting ${selectedIds.length} records...`);
    try {
      for (const id of selectedIds) {
        await apiFetch(`/api/evaluations/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      toast.dismiss(tId);
      toast.success(`Successfully deleted ${selectedIds.length} records!`);
      setSelectedIds([]);
      fetchEvals();
    } catch (e) {
      toast.dismiss(tId);
      toast.error('Error deleting appraisal records');
    }
  };

  // Import Handler
  const handleImportSubmit = async () => {
    if (!importText.trim()) {
      toast.error('Please paste or upload JSON data to import.');
      return;
    }

    setImporting(true);
    const tId = toast.loading('Parsing and importing evaluation logs...');
    try {
      const parsed = JSON.parse(importText);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      
      let importedCount = 0;
      for (const item of items) {
        if (!item.employeeName || !item.employeeId) continue;
        
        await apiFetch('/api/evaluations', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}` 
          },
          body: JSON.stringify({
            employeeId: item.employeeId,
            employeeName: item.employeeName,
            campus: item.campus || 'Main Campus',
            department: item.department || 'Academic',
            position: item.position || 'Specialist',
            evaluationType: item.evaluationType || 'operations',
            reviewDate: item.reviewDate || format(new Date(), 'yyyy-MM-dd'),
            weightScheme: item.weightScheme || 'campus_100',
            totalSelf: item.totalSelf ?? item.totalSelfScore ?? 80,
            totalSuper: item.totalSuper ?? item.totalSuperScore ?? 85,
            overallScore: item.overallScore ?? 83,
            status: item.status || 'Draft',
            criteriaScores: item.criteriaScores || [],
            peerFeedbacks: item.peerFeedbacks || [],
            evaluatorComments: item.evaluatorComments || ''
          })
        });
        importedCount++;
      }

      toast.dismiss(tId);
      toast.success(`Successfully imported ${importedCount} evaluations!`);
      setImportModalOpen(false);
      setImportText('');
      fetchEvals();
    } catch (e) {
      toast.dismiss(tId);
      toast.error('Failed to import. Please make sure data matches standard JSON schema.');
    } finally {
      setImporting(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterCampus('');
    setFilterPeriod('');
    setFilterRating('');
    setFilterStatus('');
    setCurrentPage(1);
    toast.success('Filters reset to default!');
  };

  // Statistics calculation
  const totalStaffCount = evals.length;
  const avgScore = useMemo(() => {
    return evals.length ? (evals.reduce((sum, e) => sum + e.overallScore, 0) / evals.length).toFixed(1) : '0.0';
  }, [evals]);
  const topScore = useMemo(() => {
    return evals.length ? Math.max(...evals.map(e => e.overallScore)).toFixed(1) : '0.0';
  }, [evals]);
  const needsImprovementCount = useMemo(() => {
    return evals.filter(e => e.overallScore < 70).length;
  }, [evals]);

  // Handle single selection toggle
  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Handle master select
  const toggleSelectAll = () => {
    const currentIds = paginatedEvals.map(e => String(e.id));
    const allSelected = currentIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !currentIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...currentIds])));
    }
  };

  const isRowSelected = (id: string) => selectedIds.includes(String(id));

  // Sort arrow renderer
  const renderSortArrow = (field: keyof Evaluation | 'rating') => {
    if (sortField !== field) return <ArrowUpDown size={14} className="opacity-40" />;
    return (
      <motion.div layoutId="sortArrow" className="text-indigo-500">
        <ArrowUpDown size={14} className={sortOrder === 'asc' ? 'rotate-180 transition-transform' : ''} />
      </motion.div>
    );
  };

  return (
    <div className="relative min-h-screen bg-[#fafbfc] dark:bg-[#090d16] text-slate-800 dark:text-slate-100 transition-colors duration-500 pb-16">
      
      {/* Premium Aurora Background Gradient Mesh */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-15%] w-[65%] h-[65%] rounded-full bg-indigo-400/15 dark:bg-indigo-500/10 blur-[180px] md:blur-[250px] animate-pulse" style={{ animationDuration: '20s' }} />
        <div className="absolute top-[15%] right-[-10%] w-[55%] h-[55%] rounded-full bg-purple-400/15 dark:bg-purple-600/5 blur-[200px] md:blur-[260px] animate-pulse" style={{ animationDuration: '28s', animationDelay: '4s' }} />
        <div className="absolute bottom-[-10%] left-[10%] w-[60%] h-[60%] rounded-full bg-blue-300/15 dark:bg-sky-500/10 blur-[180px] md:blur-[250px] animate-pulse" style={{ animationDuration: '24s', animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[25%] w-[45%] h-[45%] rounded-full bg-pink-300/10 dark:bg-pink-500/5 blur-[160px] md:blur-[220px] animate-pulse" style={{ animationDuration: '32s', animationDelay: '6s' }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 relative z-10 pt-4">

        {/* Print Header */}
        <div className="hidden print:block text-center border-b pb-6">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-2">របាយការណ៍វាយតម្លៃបុគ្គលិកប្រចាំឆ្នាំ</h1>
          <h2 className="text-xl font-bold text-slate-700 uppercase tracking-wide">Annual Performance Evaluations Log</h2>
          <p className="text-sm text-slate-500 mt-2">Generated on {format(new Date(), 'dd MMMM yyyy, h:mm a')}</p>
        </div>

        {/* Premium Dark Navy Header Card (SaaS Hero Accent) */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative bg-slate-900 text-white p-6 sm:p-8 rounded-[28px] shadow-2xl border border-slate-800/80 overflow-hidden print:hidden"
        >
          {/* Subtle light mesh accent within header */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-indigo-500/20 via-transparent to-transparent opacity-60" />
          <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:20px_20px]" />
          
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="p-3.5 bg-gradient-to-tr from-indigo-500 to-indigo-600 rounded-2xl shadow-lg ring-4 ring-indigo-500/25 animate-pulse">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-sans">
                  របាយការណ៍វាយតម្លៃបុគ្គលិកប្រចាំឆ្នាំ
                </h1>
                <p className="text-indigo-200 text-sm sm:text-base font-medium mt-1 tracking-wide">
                  Annual Performance Dashboard <span className="mx-2 text-indigo-400">•</span> Staff Evaluation Management System
                </p>
              </div>
            </div>

            {/* Right side utilities integrated smoothly */}
            <div className="flex items-center flex-wrap gap-3.5 bg-slate-800/40 backdrop-blur-md p-2 rounded-2xl border border-white/5 self-start md:self-auto">
              {/* Notification Bell */}
              <button 
                onClick={() => toast('No new administrator notifications.', { icon: '🔔' })}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all relative"
                title="Notifications"
              >
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-slate-900" />
              </button>

              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <div className="h-6 w-[1px] bg-white/10" />

              {/* Active User Avatar & Logout */}
              <div className="flex items-center gap-2 px-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-bold flex items-center justify-center text-sm shadow-md ring-2 ring-indigo-500/30">
                  {user?.name?.charAt(0) || 'A'}
                </div>
                <div className="hidden sm:block text-xs font-semibold text-slate-200">
                  {user?.name || 'Administrator'}
                </div>
              </div>

              <button 
                onClick={logout}
                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all ml-1"
                title="Sign Out"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Dynamic Overview Tabs with Framer Motion Slider */}
        <div className="flex bg-slate-200/50 dark:bg-slate-900/60 backdrop-blur-md p-1.5 rounded-2xl w-full max-w-[420px] border border-slate-200/30 dark:border-slate-800/40 print:hidden shadow-sm">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "relative flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2",
              activeTab === 'overview' ? "text-indigo-600 dark:text-white shadow-sm font-extrabold" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            {activeTab === 'overview' && (
              <motion.div 
                layoutId="activeTabIndicator" 
                className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-md z-0" 
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Layers size={16} />
              ទិដ្ឋភាពទូទៅ / Overview
            </span>
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={cn(
              "relative flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2",
              activeTab === 'analytics' ? "text-indigo-600 dark:text-white shadow-sm font-extrabold" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            )}
          >
            {activeTab === 'analytics' && (
              <motion.div 
                layoutId="activeTabIndicator" 
                className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-md z-0" 
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <BarChart2 size={16} />
              វិភាគទិន្នន័យ / Analytics
            </span>
          </button>
        </div>

        {activeTab === 'overview' && (
          <>
            {/* Statistics Grid - Glassmorphism style */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 print:hidden">
              <StatCard 
                title="👥 TOTAL STAFF" 
                value={totalStaffCount.toString()} 
                description="Active evaluations in period"
                color="blue" 
              />
              <StatCard 
                title="📈 AVERAGE SCORE" 
                value={`${avgScore}`} 
                description="Global performance average"
                color="indigo" 
              />
              <StatCard 
                title="🏆 TOP PERFORMER" 
                value={`${topScore}`} 
                description="Highest appraisal outcome"
                color="emerald" 
              />
              <StatCard 
                title="⚠️ NEEDS IMPROVEMENT" 
                value={needsImprovementCount.toString()} 
                description="Appraisals marked below 70.0"
                color="amber" 
              />
            </div>

            {/* Main Evaluation Reports Card */}
            <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 border border-white/50 dark:border-slate-800/40 rounded-[28px] shadow-2xl overflow-hidden p-6 sm:p-8 print:border-none print:shadow-none print:bg-transparent">
              
              {/* Card Header & Description */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200/50 dark:border-slate-800/50">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <span className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
                      <FileSpreadsheet size={22} />
                    </span>
                    របាយការណ៍វាយតម្លៃលទ្ធផលការងារ / Evaluation Reports Log
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 ml-11">
                    Audit, export, and search overall appraisal scoring outcomes across corporate structures.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5 self-end md:self-auto">
                  <Link 
                    to="/evaluation"
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl transition-all duration-300 shadow-md shadow-indigo-600/15"
                  >
                    <Plus size={16} />
                    បន្ថែមរបាយការណ៍ / New Evaluation
                  </Link>
                </div>
              </div>

              {/* Advanced Filter and Search Control Toolbar */}
              <div className="mt-6 space-y-4 print:hidden">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-3.5">
                  {/* Search bar */}
                  <div className="lg:col-span-2 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <input
                      type="text"
                      placeholder="ស្វែងរកតាម ឈ្មោះ, លេខសម្គាល់ ឬតួនាទី... / Search..."
                      className="w-full pl-11 pr-4 py-3 bg-white/60 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Campus filter */}
                  <div className="relative">
                    <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select
                      className="w-full pl-10 pr-4 py-3 bg-white/60 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-800 dark:text-slate-200 appearance-none cursor-pointer"
                      value={filterCampus}
                      onChange={(e) => setFilterCampus(e.target.value)}
                    >
                      <option value="">សាខាទាំងអស់ / All Campuses</option>
                      {campuses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Period filter */}
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <select
                      className="w-full pl-10 pr-4 py-3 bg-white/60 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-800 dark:text-slate-200 appearance-none cursor-pointer"
                      value={filterPeriod}
                      onChange={(e) => setFilterPeriod(e.target.value)}
                    >
                      <option value="">កាលបរិច្ឆេទទាំងអស់ / All Periods</option>
                      {periods.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Rating filter */}
                  <select
                    className="w-full px-4 py-3 bg-white/60 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                    value={filterRating}
                    onChange={(e) => setFilterRating(e.target.value)}
                  >
                    <option value="">ចំណាត់ថ្នាក់ទាំងអស់ / All Ratings</option>
                    <option value="Outstanding">Outstanding (ល្អប្រសើរបំផុត)</option>
                    <option value="Excellent">Excellent (ល្អណាស់)</option>
                    <option value="Very Good">Very Good (ល្អប្រសើរ)</option>
                    <option value="Good">Good (ល្អបង្គួរ)</option>
                    <option value="Needs Improvement">Needs Improvement (ត្រូវកែលម្អ)</option>
                  </select>

                  {/* Status filter */}
                  <select
                    className="w-full px-4 py-3 bg-white/60 dark:bg-slate-950/40 border border-slate-200/70 dark:border-slate-800/60 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="">ស្ថានភាពទាំងអស់ / All Statuses</option>
                    {Object.keys(STATUS_LABELS).map(key => (
                      <option key={key} value={key}>{STATUS_LABELS[key].kh} ({key})</option>
                    ))}
                  </select>

                  {/* Actions & Utilities Bar */}
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleResetFilters}
                      className="flex-1 md:flex-none px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-1.5"
                      title="Reset Filters"
                    >
                      <RefreshCw size={15} />
                      Reset
                    </button>
                    <button
                      onClick={fetchEvals}
                      className="px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition-all flex items-center justify-center"
                      title="Refresh Logs"
                    >
                      <RefreshCw size={15} className={cn(loading && "animate-spin")} />
                    </button>
                  </div>
                </div>

                {/* Main Premium Toolbar Actions Panel */}
                <div className="bg-slate-50/50 dark:bg-slate-950/20 p-3.5 rounded-2xl border border-slate-200/50 dark:border-slate-800/30 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Reports Actions:</span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Excel Export */}
                    <button 
                      onClick={handleExportExcel}
                      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
                    >
                      <Download size={14} />
                      Export Excel
                    </button>

                    {/* PDF Export */}
                    <button 
                      onClick={handlePrint}
                      className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-indigo-500/10 cursor-pointer"
                    >
                      <Printer size={14} />
                      Print / PDF Report
                    </button>

                    {/* JSON Export */}
                    <button 
                      onClick={handleExportJSON}
                      className="flex items-center gap-2 px-4 py-2.5 bg-violet-500 hover:bg-violet-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-violet-500/10 cursor-pointer"
                    >
                      <FileJson size={14} />
                      Export JSON
                    </button>

                    {/* Telegram Dispatch */}
                    <button 
                      onClick={handleBulkTelegram}
                      className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-sky-500/10 cursor-pointer"
                    >
                      <Send size={14} />
                      Bulk Telegram
                    </button>

                    {/* Import Manager Button */}
                    <button 
                      onClick={() => setImportModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 font-extrabold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                    >
                      <Upload size={14} />
                      Import Logs
                    </button>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="relative mt-6 overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/40 dark:bg-slate-950/10">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400 border-collapse">
                  <thead className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200/80 dark:border-slate-800 sticky top-0 z-10 select-none">
                    <tr>
                      <th className="px-5 py-4 w-10 text-center print:hidden">
                        <input 
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          checked={paginatedEvals.length > 0 && paginatedEvals.every(e => isRowSelected(String(e.id)))}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="px-5 py-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => { setSortField('employeeName'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                        <div className="flex items-center gap-1.5">
                          <span>បុគ្គលិក / Employee</span>
                          {renderSortArrow('employeeName')}
                        </div>
                      </th>
                      <th className="px-5 py-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => { setSortField('employeeId'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                        <div className="flex items-center gap-1.5">
                          <span>Staff ID</span>
                          {renderSortArrow('employeeId')}
                        </div>
                      </th>
                      <th className="px-5 py-4 cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => { setSortField('campus'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                        <div className="flex items-center gap-1.5">
                          <span>សាខា / Campus</span>
                          {renderSortArrow('campus')}
                        </div>
                      </th>
                      <th className="px-5 py-4">តួនាទី / Position</th>
                      <th className="px-4 py-4 text-center">Self</th>
                      <th className="px-4 py-4 text-center">Super</th>
                      <th className="px-4 py-4 text-center">Supporter</th>
                      <th className="px-4 py-4 text-center">Mgmt</th>
                      <th className="px-5 py-4 text-center cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => { setSortField('overallScore'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Overall</span>
                          {renderSortArrow('overallScore')}
                        </div>
                      </th>
                      <th className="px-5 py-4 text-center cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => { setSortField('rating'); setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc'); }}>
                        <div className="flex items-center justify-center gap-1.5">
                          <span>Rating</span>
                          {renderSortArrow('rating')}
                        </div>
                      </th>
                      <th className="px-5 py-4 text-center">ស្ថានភាព / Status</th>
                      <th className="px-5 py-4 text-right print:hidden">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                    {loading ? (
                      <tr>
                        <td colSpan={13} className="px-5 py-16 text-center text-slate-400 dark:text-slate-500 font-bold">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="animate-spin text-indigo-500" size={32} />
                            <span>កំពុងផ្ទុកទិន្នន័យ... / Loading appraisal records...</span>
                          </div>
                        </td>
                      </tr>
                    ) : sortedEvals.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="px-5 py-16 text-center">
                          <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-4">
                            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-full text-slate-400">
                              <ShieldAlert size={48} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">
                              រកមិនឃើញរបាយការណ៍វាយតម្លៃទេ
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              No evaluation reports available matching your selected search query and filter criteria.
                            </p>
                            <button
                              onClick={handleResetFilters}
                              className="px-5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-extrabold text-sm rounded-xl transition-all"
                            >
                              Clear All Filters
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <AnimatePresence mode="popLayout">
                        {paginatedEvals.map((evalRecord, idx) => {
                          const rating = getRating(evalRecord.overallScore);
                          const statusDef = evalRecord.status ? STATUS_LABELS[evalRecord.status] : STATUS_LABELS['Draft'];
                          const selfVal = getSelfScore(evalRecord);
                          const superVal = getSuperScore(evalRecord);
                          const supportVal = getSupporterScore(evalRecord);
                          const mgmtVal = getManagementScore(evalRecord);

                          return (
                            <motion.tr 
                              key={evalRecord.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              transition={{ duration: 0.25, delay: idx * 0.03 }}
                              className={cn(
                                "hover:bg-slate-100/30 dark:hover:bg-slate-800/10 transition-all duration-150 group",
                                idx % 2 === 1 ? 'bg-slate-50/20 dark:bg-slate-900/10' : '',
                                isRowSelected(String(evalRecord.id)) ? 'bg-indigo-50/40 dark:bg-indigo-950/10 border-l-2 border-indigo-500' : ''
                              )}
                            >
                              {/* Checkbox */}
                              <td className="px-5 py-4 text-center print:hidden">
                                <input 
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  checked={isRowSelected(String(evalRecord.id))}
                                  onChange={() => toggleSelectRow(String(evalRecord.id))}
                                />
                              </td>

                              {/* Employee Details with stylish avatar */}
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center text-xs shadow-inner">
                                    {evalRecord.employeeName?.substring(0, 2).toUpperCase() || 'EM'}
                                  </div>
                                  <div>
                                    <div className="font-extrabold text-slate-900 dark:text-slate-100 font-sans tracking-tight leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                      {evalRecord.employeeName}
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5 tracking-wider uppercase">
                                      {evalRecord.evaluationType || 'Operations'} Appraisals
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Staff ID */}
                              <td className="px-5 py-4">
                                <span className="font-mono text-xs font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
                                  {evalRecord.employeeId}
                                </span>
                              </td>

                              {/* Campus */}
                              <td className="px-5 py-4">
                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                  {evalRecord.campus}
                                </div>
                              </td>

                              {/* Department & Position */}
                              <td className="px-5 py-4">
                                <div className="font-semibold text-slate-800 dark:text-slate-300">
                                  {evalRecord.position}
                                </div>
                                <div className="text-xs text-slate-400 dark:text-slate-500">
                                  {evalRecord.department || 'General Administration'}
                                </div>
                              </td>

                              {/* Self Score Badge */}
                              <td className="px-4 py-4 text-center">
                                <span className="inline-block px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs rounded-lg border border-blue-500/20 w-11 text-center">
                                  {selfVal.toFixed(0)}
                                </span>
                              </td>

                              {/* Supervisor Score Badge */}
                              <td className="px-4 py-4 text-center">
                                <span className="inline-block px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-lg border border-emerald-500/20 w-11 text-center">
                                  {superVal.toFixed(0)}
                                </span>
                              </td>

                              {/* Supporter Score Badge */}
                              <td className="px-4 py-4 text-center">
                                <span className="inline-block px-2 py-1 bg-violet-500/10 text-violet-600 dark:text-violet-400 font-bold text-xs rounded-lg border border-violet-500/20 w-11 text-center">
                                  {supportVal.toFixed(0)}
                                </span>
                              </td>

                              {/* Management Score Badge */}
                              <td className="px-4 py-4 text-center">
                                <span className="inline-block px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs rounded-lg border border-amber-500/20 w-11 text-center">
                                  {mgmtVal.toFixed(0)}
                                </span>
                              </td>

                              {/* Overall Score with extra premium glow */}
                              <td className="px-5 py-4 text-center">
                                <span className="inline-block px-3 py-1 bg-indigo-500 text-white font-extrabold text-sm rounded-xl shadow-lg shadow-indigo-500/20 border border-indigo-400/30 w-14 text-center">
                                  {evalRecord.overallScore.toFixed(1)}
                                </span>
                              </td>

                              {/* Rating Chips with specific colors */}
                              <td className="px-5 py-4 text-center">
                                <div className="flex flex-col items-center">
                                  <span className={cn(
                                    "px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wide whitespace-nowrap border",
                                    rating.bg
                                  )}>
                                    {rating.khLabel}
                                  </span>
                                  <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wide mt-1">
                                    {rating.label}
                                  </span>
                                </div>
                              </td>

                              {/* Status badge with specific colors */}
                              <td className="px-5 py-4 text-center">
                                {statusDef && (
                                  <div className={cn(
                                    "inline-flex flex-col items-center justify-center px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap text-center shadow-sm", 
                                    statusDef.color
                                  )}>
                                    <span>{statusDef.kh}</span>
                                    <span className="text-[9px] opacity-80 uppercase tracking-wide mt-0.5">{statusDef.label}</span>
                                  </div>
                                )}
                              </td>

                              {/* Row Actions */}
                              <td className="px-5 py-4 text-right print:hidden">
                                <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                                  {/* View Detail icon */}
                                  <button 
                                    onClick={() => navigate(`/evaluation?id=${evalRecord.id}&view=true`)} 
                                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all" 
                                    title="View appraisal profile"
                                  >
                                    <Eye size={16} />
                                  </button>
                                  
                                  {/* Edit icon */}
                                  {(user?.role === 'superadmin' || evalRecord.createdBy === user?.id) && (
                                    <button 
                                      onClick={() => navigate(`/evaluation?id=${evalRecord.id}`)} 
                                      className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all" 
                                      title="Edit appraisal data"
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                  )}
                                  
                                  {/* Delete icon */}
                                  {(user?.role === 'superadmin' || evalRecord.createdBy === user?.id) && (
                                    <button 
                                      onClick={async () => {
                                        if (window.confirm("Are you sure you want to delete this appraisal?")) {
                                          try {
                                            const res = await apiFetch(`/api/evaluations/${evalRecord.id}`, {
                                              method: 'DELETE',
                                              headers: { Authorization: `Bearer ${token}` }
                                            });
                                            if (res.ok) {
                                              toast.success('Successfully deleted appraisal record.');
                                              fetchEvals();
                                            } else {
                                              const err = await res.json();
                                              toast.error(err.error);
                                            }
                                          } catch(e) { toast.error('Error deleting appraisal'); }
                                        }
                                      }} 
                                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-rose-500/10 rounded-xl transition-all" 
                                      title="Delete"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </AnimatePresence>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Advanced Pagination controls */}
              {sortedEvals.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-6 print:hidden">
                  <div className="text-sm text-slate-500 font-medium">
                    Showing <span className="font-extrabold text-slate-700 dark:text-slate-300">{Math.min(sortedEvals.length, (currentPage - 1) * itemsPerPage + 1)}</span> to{' '}
                    <span className="font-extrabold text-slate-700 dark:text-slate-300">{Math.min(sortedEvals.length, currentPage * itemsPerPage)}</span> of{' '}
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{sortedEvals.length}</span> appraisal reports
                  </div>

                  <div className="flex items-center gap-3 self-center sm:self-auto">
                    {/* Rows per page selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Per Page:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="bg-white/60 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-300"
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                        title="Previous Page"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                        // show limited page numbers if there are too many
                        if (totalPages > 6 && Math.abs(currentPage - p) > 1 && p !== 1 && p !== totalPages) {
                          if (p === 2 || p === totalPages - 1) {
                            return <span key={p} className="text-slate-400 px-1 text-xs select-none">...</span>;
                          }
                          return null;
                        }

                        return (
                          <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            className={cn(
                              "w-8 h-8 rounded-lg text-xs font-extrabold transition-all",
                              currentPage === p 
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/15" 
                                : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                            )}
                          >
                            {p}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 rounded-lg text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                        title="Next Page"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Analytics Tab (fully customized) */}
        {activeTab === 'analytics' && (
          <AnalyticsDashboard evals={evals} />
        )}
      </div>

      {/* Bulk actions sliding bar from the bottom */}
      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-5 z-50 w-[90%] max-w-[620px] justify-between"
          >
            <div className="flex items-center gap-3">
              <span className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
                <CheckCircle size={18} />
              </span>
              <div>
                <span className="font-extrabold text-sm">{selectedIds.length} items</span> Selected
                <p className="text-[10px] text-slate-400 font-medium">Perform batch actions on selected appraisal records</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkApprove}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer"
              >
                <Check size={14} />
                Approve
              </button>
              <button
                onClick={handleBulkTelegram}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-600 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer"
              >
                <Send size={14} />
                Dispatch
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1 cursor-pointer"
              >
                <Trash2 size={14} />
                Delete
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="p-2 text-slate-400 hover:text-white rounded-lg transition-all"
                title="Cancel selection"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Interactive JSON/Excel Import Manager Modal Dialog */}
      <AnimatePresence>
        {importModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
              onClick={() => setImportModalOpen(false)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden z-10"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500" />
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Upload size={20} className="text-indigo-500" />
                  នាំចូលទិន្នន័យវាយតម្លៃ / Import Evaluation Logs
                </h3>
                <button 
                  onClick={() => setImportModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportType('json')}
                    className={cn(
                      "px-4 py-2 text-xs font-bold rounded-lg transition-all",
                      importType === 'json' ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    JSON Schema
                  </button>
                  <button
                    onClick={() => {
                      setImportType('excel');
                      toast('Paste JSON matching schema for fast execution.', { icon: 'ℹ️' });
                    }}
                    className={cn(
                      "px-4 py-2 text-xs font-bold rounded-lg transition-all",
                      importType === 'excel' ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    CSV/XLSX Helper
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Paste JSON Array of Appraisal Records
                  </label>
                  <textarea
                    rows={8}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder={`[\n  {\n    "employeeId": "EMP1005",\n    "employeeName": "Sok Chan",\n    "campus": "Phnom Penh",\n    "position": "Lecturer",\n    "overallScore": 88.5\n  }\n]`}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                  />
                </div>

                <div className="p-3.5 bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500">
                  <span className="font-bold text-indigo-500 block mb-1">Standard fields required:</span>
                  employeeName (string), employeeId (string), campus (string), position (string), overallScore (number).
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3.5 border-t border-slate-200 dark:border-slate-800 pt-4">
                <button
                  onClick={() => setImportModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportSubmit}
                  disabled={importing}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-sm rounded-xl transition-all shadow-md shadow-indigo-600/15 disabled:opacity-50"
                >
                  {importing ? 'Processing Import...' : 'Import Records'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// Stats Card Component - Sleek Glassmorphic layout with glowing borders
function StatCard({ title, value, description, color }: { title: string, value: string, description: string, color: 'blue'|'indigo'|'emerald'|'amber' }) {
  const settings = {
    blue: {
      accent: 'from-blue-400 to-blue-500',
      bgGlow: 'bg-blue-500/10 dark:bg-blue-500/5',
      borderGlow: 'border-blue-500/20 dark:border-blue-500/15',
      iconColor: 'text-blue-500',
      shadow: 'shadow-blue-500/5',
      icon: <Users className="w-6 h-6" />
    },
    indigo: {
      accent: 'from-indigo-400 to-indigo-500',
      bgGlow: 'bg-indigo-500/10 dark:bg-indigo-500/5',
      borderGlow: 'border-indigo-500/20 dark:border-indigo-500/15',
      iconColor: 'text-indigo-500',
      shadow: 'shadow-indigo-500/5',
      icon: <TrendingUp className="w-6 h-6" />
    },
    emerald: {
      accent: 'from-emerald-400 to-emerald-500',
      bgGlow: 'bg-emerald-500/10 dark:bg-emerald-500/5',
      borderGlow: 'border-emerald-500/20 dark:border-emerald-500/15',
      iconColor: 'text-emerald-500',
      shadow: 'shadow-emerald-500/5',
      icon: <Award className="w-6 h-6" />
    },
    amber: {
      accent: 'from-amber-400 to-amber-500',
      bgGlow: 'bg-amber-500/10 dark:bg-amber-500/5',
      borderGlow: 'border-amber-500/20 dark:border-amber-500/15',
      iconColor: 'text-amber-500',
      shadow: 'shadow-amber-500/5',
      icon: <AlertTriangle className="w-6 h-6" />
    }
  };

  const current = settings[color];

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        "backdrop-blur-md bg-white/40 dark:bg-slate-900/30 border rounded-[24px] p-6 flex flex-col justify-between transition-all duration-300 shadow-xl",
        current.borderGlow,
        current.shadow
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-extrabold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
          {title}
        </span>
        <div className={cn("p-2.5 rounded-xl shadow-inner", current.bgGlow, current.iconColor)}>
          {current.icon}
        </div>
      </div>

      <div className="mt-4">
        {/* Animated Counter Simulation */}
        <h3 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
          {value}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
          {description}
        </p>
      </div>

      {/* Decorative colored glow strip at bottom */}
      <div className={cn("h-1.5 w-12 rounded-full mt-4 bg-gradient-to-r", current.accent)} />
    </motion.div>
  );
}

// Highly stylized Analytics Dashboard with executive charts
function AnalyticsDashboard({ evals }: { evals: Evaluation[] }) {
  if (evals.length === 0) {
    return (
      <div className="p-16 text-center text-slate-400 font-bold bg-white/50 dark:bg-slate-900/40 rounded-3xl border border-slate-200 dark:border-slate-800 backdrop-blur-md shadow-lg max-w-lg mx-auto mt-12">
        <ShieldAlert size={48} className="mx-auto text-indigo-500 mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">គ្មានទិន្នន័យដើម្បីវិភាគទេ</h3>
        <p className="text-sm font-medium text-slate-500 mt-2">Please complete at least one staff performance evaluation to view analytic widgets.</p>
      </div>
    );
  }

  // Campus Performance
  const campusScores = evals.reduce((acc, curr) => {
    if (!acc[curr.campus]) {
      acc[curr.campus] = { name: curr.campus, totalScore: 0, count: 0 };
    }
    acc[curr.campus].totalScore += curr.overallScore;
    acc[curr.campus].count += 1;
    return acc;
  }, {} as Record<string, { name: string, totalScore: number, count: number }>);
  
  const campusData = Object.values(campusScores).map(c => ({
    name: c.name,
    score: Number((c.totalScore / c.count).toFixed(1))
  }));

  // Rating Distribution
  const ratingCounts = evals.reduce((acc, curr) => {
    const r = getRating(curr.overallScore).label;
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const COLORS = ['#6366f1', '#06b6d4', '#3b82f6', '#f59e0b', '#f43f5e'];
  const ratingData = Object.keys(ratingCounts).map((key) => ({
    name: key,
    value: ratingCounts[key]
  }));

  // Top Performers
  const topPerformers = [...evals].sort((a, b) => b.overallScore - a.overallScore).slice(0, 5).map(e => ({
    name: e.employeeName,
    score: Number(e.overallScore.toFixed(1))
  }));

  return (
    <div className="space-y-6 print:hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Campus Performance Card with beautiful gradients */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="backdrop-blur-md bg-white/40 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 p-6 sm:p-8 rounded-3xl shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">ពិន្ទុមធ្យមតាមសាខា</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Average Score by Campus</p>
            </div>
            <span className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
              <Building size={18} />
            </span>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.75}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 'bold'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 'bold'}} domain={[0, 100]} />
                <RechartsTooltip 
                  cursor={{fill: 'rgba(99, 102, 241, 0.05)', radius: 8}}
                  contentStyle={{
                    borderRadius: '16px', 
                    border: '1px solid rgba(226, 232, 240, 0.5)', 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)'
                  }} 
                />
                <Bar dataKey="score" fill="url(#barGrad)" radius={[8, 8, 0, 0]} name="Average Score" barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top Performers Horizontal Bar Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="backdrop-blur-md bg-white/40 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 p-6 sm:p-8 rounded-3xl shadow-xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">បុគ្គលិកឆ្នើម</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Top Performers appraisal scores</p>
            </div>
            <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Award size={18} />
            </span>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPerformers} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="performGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.95}/>
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.3} />
                <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 'bold'}} />
                <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 'bold'}} />
                <RechartsTooltip 
                  cursor={{fill: 'rgba(16, 185, 129, 0.05)'}}
                  contentStyle={{
                    borderRadius: '16px', 
                    border: '1px solid rgba(226, 232, 240, 0.5)', 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.05)'
                  }} 
                />
                <Bar dataKey="score" fill="url(#performGrad)" radius={[0, 8, 8, 0]} name="Score" barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Rating Distribution Pie/Donut Chart */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="backdrop-blur-md bg-white/40 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 p-6 sm:p-8 rounded-3xl shadow-xl lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">របាយការណ៍ចំណាត់ថ្នាក់</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Performance Rating Distribution</p>
            </div>
            <span className="p-2 bg-violet-500/10 text-violet-500 rounded-xl">
              <Layers size={18} />
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-around gap-6 h-[300px]">
            <div className="h-full w-full max-w-[320px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ratingData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={105}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {ratingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-none" />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{
                      borderRadius: '16px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Custom Legend for elegant design */}
            <div className="space-y-3 w-full max-w-[280px]">
              {ratingData.map((entry, idx) => (
                <div key={entry.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/50 dark:bg-slate-950/25 border border-slate-100 dark:border-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="w-3.5 h-3.5 rounded-md" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">{entry.name}</span>
                  </div>
                  <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                    {entry.value} reports
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}

// Custom rating category generator
function getRating(score: number) {
  if (score >= 95) return { label: 'Outstanding', khLabel: 'ល្អប្រសើរបំផុត', bg: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
  if (score >= 90) return { label: 'Excellent', khLabel: 'ល្អណាស់', bg: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' };
  if (score >= 80) return { label: 'Very Good', khLabel: 'ល្អប្រសើរ', bg: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
  if (score >= 70) return { label: 'Good', khLabel: 'ល្អបង្គួរ', bg: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
  return { label: 'Needs Improvement', khLabel: 'ត្រូវកែលម្អ', bg: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
}


