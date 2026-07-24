import { apiFetch } from '../mockApi';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDynamicCriteria, PREDEFINED_POSITIONS, EvaluationSection, EvaluationCriterion } from '../hooks/useSettings';
import { FileText, Save, CheckCircle, AlertTriangle, User, Search, Eye, Edit2, Shield, Trash2, HelpCircle, Briefcase, GraduationCap, DollarSign, Users, Heart, UserCheck, PlusCircle, BookOpen, Warehouse, Smile, ShieldAlert, ArrowRight, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface DynamicScore {
  criterionId: string;
  selfScore: number;
  selfComment: string;
  superScore: number;
  superComment: string;
  supporterScore: number;
  supporterComment: string;
}

interface DynamicEvaluation {
  id?: string;
  employeeId: string;
  employeeName: string;
  position: string;
  campus: string;
  department: string;
  reviewDate: string;
  evalPeriod: string;
  weightScheme: 'campus_60_40' | 'campus_50_50' | 'campus_100' | 'central_100' | 'management_100';
  status: 'Draft' | 'Submitted' | 'Supervisor Completed' | 'Completed' | 'Approved';
  scores: DynamicScore[];
  totalSelfScore: number;
  totalSuperScore: number;
  totalSupporterScore: number;
  overallScore: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  evaluationType?: string;
  sectionsSnapshot?: any[];
  criteriaSnapshot?: any[];
}

// Map positions to nice icons
const getPositionIcon = (positionName: string) => {
  switch (positionName) {
    case 'Management': return <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    case 'Central Officer': return <UserCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    case 'Supervisor': return <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    case 'HR': return <Heart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    case 'Teacher':
    case 'Teaching Assistant (TA)': return <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    case 'Accountant': return <DollarSign className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    case 'Nurse': return <PlusCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    case 'Librarian': return <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    case 'Stock Controller':
    case 'Uniform Seller': return <Warehouse className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    case 'Customer Service': return <Smile className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    case 'Discipline Officer': return <ShieldAlert className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
    default: return <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
  }
};

export default function SelfEvaluation() {
  const { user, token } = useAuth();
  const { sections, criteria, loading: criteriaLoading } = useDynamicCriteria();

  const [employees, setEmployees] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<DynamicEvaluation[]>([]);
  const [positionForms, setPositionForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Flow State
  const [activeTab, setActiveTab] = useState<'my-evals' | 'subordinate-evals' | 'form'>('my-evals');
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  
  // Active Form State
  const [currentEval, setCurrentEval] = useState<Partial<DynamicEvaluation>>({});
  const [formScores, setFormScores] = useState<Record<string, { selfScore: number; selfComment: string; superScore: number; superComment: string; supporterScore: number; supporterComment: string }>>({});
  const [isViewOnly, setIsViewOnly] = useState(false);

  // Helper to get active weighting scheme for a position
  const getWeightSchemeForPosition = (posName: string) => {
    const pf = positionForms.find(p => p.positionName.toLowerCase() === posName.toLowerCase());
    if (pf && pf.weightScheme) {
      return pf.weightScheme;
    }
    // Fallback: existing logic
    if (posName === 'Central Officer') return 'central_100';
    if (posName === 'Management') return 'management_100';
    return 'campus_60_40';
  };

  // Helper to get active evaluation type for a position
  const getEvaluationTypeForPosition = (posName: string, evaluation?: Partial<DynamicEvaluation>) => {
    if (evaluation?.evaluationType) {
      return evaluation.evaluationType;
    }
    const pf = positionForms.find(p => p.positionName.toLowerCase() === posName.toLowerCase());
    if (pf && pf.evaluationType) {
      return pf.evaluationType;
    }
    // Fallback based on name
    const lower = posName.toLowerCase();
    if (lower.includes('teacher') || lower.includes('ta') || lower.includes('teaching')) return 'teacher';
    if (lower.includes('management') || lower.includes('chief') || lower.includes('director') || lower.includes('manager') || lower.includes('supervisor')) return 'management';
    return 'operations';
  };

  // Helper to get active sections for a position
  const getSectionsForPosition = (posName: string, evaluation?: Partial<DynamicEvaluation>) => {
    if (evaluation?.sectionsSnapshot && evaluation.sectionsSnapshot.length > 0) {
      return evaluation.sectionsSnapshot.map((s: any) => ({
        id: s.id,
        nameKh: s.nameKh,
        nameEn: s.nameEn,
        weight: s.weight || Math.round(100 / evaluation.sectionsSnapshot!.length),
        order: s.order,
        status: 'Active',
        positions: [posName]
      }));
    }
    const pf = positionForms.find(p => p.positionName.toLowerCase() === posName.toLowerCase());
    if (pf && pf.sections && pf.sections.length > 0) {
      return pf.sections.map((s: any) => ({
        id: s.id,
        nameKh: s.nameKh,
        nameEn: s.nameEn,
        weight: s.weight || Math.round(100 / pf.sections.length),
        order: s.order,
        status: 'Active',
        positions: [posName]
      }));
    }
    // Fallback: global sections
    return sections.filter(s => s.status === 'Active' && s.positions.includes(posName));
  };

  // Helper to get active criteria for a position
  const getCriteriaForPosition = (posName: string, evaluation?: Partial<DynamicEvaluation>) => {
    if (evaluation?.criteriaSnapshot && evaluation.criteriaSnapshot.length > 0) {
      return evaluation.criteriaSnapshot.map((c: any) => ({
        id: c.id,
        nameKh: c.nameKh,
        nameEn: c.nameEn,
        sectionId: c.sectionId,
        positions: [posName],
        maxScore: c.maxScore || 10,
        order: c.order,
        status: 'Active'
      }));
    }
    const pf = positionForms.find(p => p.positionName.toLowerCase() === posName.toLowerCase());
    if (pf && pf.criteria && pf.criteria.length > 0) {
      return pf.criteria.map((c: any) => ({
        id: c.id,
        nameKh: c.nameKh,
        nameEn: c.nameEn,
        sectionId: c.sectionId,
        positions: [posName],
        maxScore: c.maxScore || 10,
        order: c.order,
        status: 'Active'
      }));
    }
    // Fallback: global criteria
    return criteria.filter(c => c.status === 'Active' && c.positions.includes(posName));
  };

  // Fetch initial databases
  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [empRes, evalsRes, posFormsRes] = await Promise.all([
        apiFetch('/api/employees', { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch('/api/settings/dynamic_self_evaluations', { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch('/api/settings/position_forms', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(Array.isArray(empData) ? empData : []);
      }

      if (evalsRes.ok) {
        const evalsData = await evalsRes.json();
        setEvaluations(Array.isArray(evalsData) ? evalsData : []);
      }

      if (posFormsRes.ok) {
        const pfData = await posFormsRes.json();
        setPositionForms(Array.isArray(pfData) ? pfData : []);
      }
    } catch (e) {
      console.error('Error fetching dynamic evaluation data', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvaluationsToDb = async (updatedList: DynamicEvaluation[]) => {
    try {
      await apiFetch('/api/settings/dynamic_self_evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updatedList)
      });
      setEvaluations(updatedList);
    } catch (e) {
      console.error(e);
    }
  };

  // Helper to log actions
  const logAuditAction = async (employeeId: string, action: string, details: string) => {
    try {
      await apiFetch('/api/audit-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: user?.id || 'Unknown',
          userName: user?.name || 'Unknown',
          action,
          details: `Employee ID: ${employeeId} - ${details}`
        })
      });
    } catch (e) {
      console.error('Audit logging failed', e);
    }
  };

  // Check matching profile details
  const myEmployeeProfile = employees.find(e => e.id === user?.id || e.name.toLowerCase() === user?.name.toLowerCase());
  const officialPosition = myEmployeeProfile?.position || '';

  const isPositionMatched = !selectedPosition || selectedPosition.toLowerCase() === officialPosition.toLowerCase() || user?.role === 'superadmin' || user?.role === 'admin';

  // Handle Starting a New Evaluation
  const handleStartNewEval = () => {
    if (!selectedPosition) {
      toast.error('Please select your position first.');
      return;
    }

    const defaultWeightScheme = getWeightSchemeForPosition(selectedPosition);
    const evalType = getEvaluationTypeForPosition(selectedPosition);
    const positionSections = getSectionsForPosition(selectedPosition);
    const positionCriteria = getCriteriaForPosition(selectedPosition);

    // Seed empty scores for positions criteria
    const initialScores: Record<string, any> = {};
    positionCriteria.forEach(c => {
      initialScores[c.id] = {
        selfScore: 0,
        selfComment: '',
        superScore: 0,
        superComment: '',
        supporterScore: 0,
        supporterComment: ''
      };
    });

    const newEval: Partial<DynamicEvaluation> = {
      id: 'dynamic_eval_' + Date.now(),
      employeeId: myEmployeeProfile?.id || user?.id || 'EMP-TEMP',
      employeeName: myEmployeeProfile?.name || user?.name || 'Temporary Employee',
      position: selectedPosition,
      campus: myEmployeeProfile?.campus || 'Phnom Penh',
      department: myEmployeeProfile?.department || 'Operations',
      reviewDate: new Date().toISOString().split('T')[0],
      evalPeriod: myEmployeeProfile?.evalPeriod || 'Annual 2026',
      weightScheme: defaultWeightScheme as any,
      evaluationType: evalType,
      status: 'Draft',
      createdBy: user?.id || '',
      createdByName: user?.name || '',
      createdAt: new Date().toISOString(),
      sectionsSnapshot: positionSections,
      criteriaSnapshot: positionCriteria
    };

    setCurrentEval(newEval);
    setFormScores(initialScores);
    setIsViewOnly(false);
    setActiveTab('form');
  };

  const handleSelectPosition = (pos: string) => {
    setSelectedPosition(pos);
    
    // Auto-load Evaluation Type and Weighting Scheme from the employee's profile/dynamic positions
    const defaultWeightScheme = getWeightSchemeForPosition(pos);
    const evalType = getEvaluationTypeForPosition(pos);
    const positionSections = getSectionsForPosition(pos);
    const positionCriteria = getCriteriaForPosition(pos);

    // Seed empty scores for position's criteria
    const initialScores: Record<string, any> = {};
    positionCriteria.forEach(c => {
      initialScores[c.id] = {
        selfScore: 0,
        selfComment: '',
        superScore: 0,
        superComment: '',
        supporterScore: 0,
        supporterComment: ''
      };
    });

    const newEval: Partial<DynamicEvaluation> = {
      id: 'dynamic_eval_' + Date.now(),
      employeeId: myEmployeeProfile?.id || user?.id || 'EMP-TEMP',
      employeeName: myEmployeeProfile?.name || user?.name || 'Temporary Employee',
      position: pos,
      campus: myEmployeeProfile?.campus || 'Phnom Penh',
      department: myEmployeeProfile?.department || 'Operations',
      reviewDate: new Date().toISOString().split('T')[0],
      evalPeriod: myEmployeeProfile?.evalPeriod || 'Annual 2026',
      weightScheme: defaultWeightScheme as any,
      evaluationType: evalType,
      status: 'Draft',
      createdBy: user?.id || '',
      createdByName: user?.name || '',
      createdAt: new Date().toISOString(),
      sectionsSnapshot: positionSections,
      criteriaSnapshot: positionCriteria
    };

    setCurrentEval(newEval);
    setFormScores(initialScores);
    setIsViewOnly(false);
    setActiveTab('form');
    
    toast.success(`Position ${pos} selected. Settings automatically loaded from profile.`);
  };

  // Handle Editing an existing evaluation
  const handleEditEval = (evaluation: DynamicEvaluation, viewOnly = false) => {
    const initialScores: Record<string, any> = {};
    evaluation.scores.forEach(s => {
      initialScores[s.criterionId] = {
        selfScore: s.selfScore || 0,
        selfComment: s.selfComment || '',
        superScore: s.superScore || 0,
        superComment: s.superComment || '',
        supporterScore: s.supporterScore || 0,
        supporterComment: s.supporterComment || ''
      };
    });

    // Make sure any missing active criteria for this position are added
    const posCriteria = getCriteriaForPosition(evaluation.position, evaluation);
    posCriteria.forEach(c => {
      if (!initialScores[c.id]) {
        initialScores[c.id] = {
          selfScore: 0,
          selfComment: '',
          superScore: 0,
          superComment: '',
          supporterScore: 0,
          supporterComment: ''
        };
      }
    });

    setSelectedPosition(evaluation.position);
    setCurrentEval(evaluation);
    setFormScores(initialScores);
    setIsViewOnly(viewOnly);
    setActiveTab('form');
  };

  // Scoring changes handler
  const handleScoreChange = (critId: string, field: 'selfScore' | 'superScore' | 'supporterScore', val: number) => {
    setFormScores(prev => ({
      ...prev,
      [critId]: {
        ...prev[critId],
        [field]: val
      }
    }));
  };

  // Comment changes handler
  const handleCommentChange = (critId: string, field: 'selfComment' | 'superComment' | 'supporterComment', val: string) => {
    setFormScores(prev => ({
      ...prev,
      [critId]: {
        ...prev[critId],
        [field]: val
      }
    }));
  };

  // Validation: Check if comments are missing for any scored criterion
  const getMissingCommentsCount = () => {
    let missing = 0;
    const activeCritList = getCriteriaForPosition(selectedPosition, currentEval);
    activeCritList.forEach(c => {
      const scoreObj = formScores[c.id];
      if (scoreObj) {
        if (scoreObj.selfScore > 0 && !scoreObj.selfComment.trim()) {
          missing++;
        }
      }
    });
    return missing;
  };

  // Submit/Save Form Action
  const handleFormAction = async (action: 'save' | 'submit' | 'supervisor-submit' | 'supporter-submit') => {
    // 1. Position match verification
    if (!isPositionMatched) {
      toast.error('You cannot submit because the selected position does not match your official profile position.');
      return;
    }

    // 2. Comments justification check for Employee Submit
    if (action === 'submit') {
      const missingCount = getMissingCommentsCount();
      if (missingCount > 0) {
        toast.error(`Please provide written justification comments for all ${missingCount} scored criteria before submitting.`);
        return;
      }
    }

    // Prepare scores array
    const scoreItems: DynamicScore[] = Object.keys(formScores).map(critId => ({
      criterionId: critId,
      selfScore: Number(formScores[critId].selfScore) || 0,
      selfComment: formScores[critId].selfComment || '',
      superScore: Number(formScores[critId].superScore) || 0,
      superComment: formScores[critId].superComment || '',
      supporterScore: Number(formScores[critId].supporterScore) || 0,
      supporterComment: formScores[critId].supporterComment || ''
    }));

    // Calculate aggregations
    const totalSelf = scoreItems.reduce((sum, item) => sum + item.selfScore, 0);
    const totalSuper = scoreItems.reduce((sum, item) => sum + item.superScore, 0);
    const totalSupporter = scoreItems.reduce((sum, item) => sum + item.supporterScore, 0);

    // Calculate maximum possible scores
    const activeCritList = getCriteriaForPosition(selectedPosition, currentEval);
    const maxPossible = activeCritList.reduce((sum, c) => sum + (c.maxScore || 10), 0);

    // Determine target status
    let targetStatus: any = currentEval.status || 'Draft';
    if (action === 'submit') targetStatus = 'Submitted';
    else if (action === 'supervisor-submit') targetStatus = 'Supervisor Completed';
    else if (action === 'supporter-submit') targetStatus = 'Completed';

    // Calculate Overall Score based on evaluation weight rules
    let overall = 0;
    const model = currentEval.weightScheme || 'campus_60_40';
    if (maxPossible > 0) {
      if (model === 'central_100' || model === 'campus_100') {
        overall = (totalSuper / maxPossible) * 100;
      } else if (model === 'campus_60_40') {
        overall = ((totalSuper * 0.6) + (totalSupporter * 0.4)) / maxPossible * 100;
      } else if (model === 'campus_50_50') {
        overall = ((totalSuper * 0.5) + (totalSupporter * 0.5)) / maxPossible * 100;
      } else {
        overall = (totalSuper / maxPossible) * 100;
      }
    }
    overall = Math.min(100, Math.max(0, overall));

    const updatedEval: DynamicEvaluation = {
      ...(currentEval as any),
      scores: scoreItems,
      totalSelfScore: totalSelf,
      totalSuperScore: totalSuper,
      totalSupporterScore: totalSupporter,
      overallScore: Number(overall.toFixed(1)),
      status: targetStatus,
      createdAt: currentEval.createdAt || new Date().toISOString(),
      sectionsSnapshot: currentEval.sectionsSnapshot || getSectionsForPosition(selectedPosition, currentEval),
      criteriaSnapshot: currentEval.criteriaSnapshot || activeCritList
    };

    const isNew = !evaluations.some(ev => ev.id === updatedEval.id);
    let newEvalsList = [];
    if (isNew) {
      newEvalsList = [updatedEval, ...evaluations];
    } else {
      newEvalsList = evaluations.map(ev => ev.id === updatedEval.id ? updatedEval : ev);
    }

    await handleSaveEvaluationsToDb(newEvalsList);
    await logAuditAction(
      updatedEval.employeeId,
      action === 'save' ? 'Save Self-Evaluation Draft' : 'Submit Evaluation Action',
      `Action: ${action}, Status: ${targetStatus}, Overall Score: ${updatedEval.overallScore}%`
    );

    toast.success(action === 'save' ? 'Draft saved successfully!' : 'Evaluation submitted successfully!');
    setActiveTab('my-evals');
  };

  // Delete Action for Admins
  const handleDeleteEval = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this self-evaluation record?')) return;
    const item = evaluations.find(e => e.id === id);
    const newEvalsList = evaluations.filter(e => e.id !== id);
    await handleSaveEvaluationsToDb(newEvalsList);
    if (item) {
      await logAuditAction(item.employeeId, 'Delete Evaluation Record', `Deleted evaluation with ID: ${id}`);
    }
    toast.success('Evaluation record deleted successfully.');
  };

  // Filter lists based on roles
  const myEvals = evaluations.filter(ev => ev.employeeId === user?.id || ev.createdBy === user?.id);
  
  // Subordinates include matches where logged in user is supervisor or supporter or is superadmin
  const subordinateEvals = evaluations.filter(ev => {
    // Super admin sees all
    if (user?.role === 'superadmin' || user?.role === 'admin') return true;
    
    // Check if logged-in user is supervisor or supporter for this evaluation
    const employeeProfile = employees.find(e => e.id === ev.employeeId);
    if (employeeProfile) {
      const isSupervisor = employeeProfile.supervisorId === user?.id;
      const isSupporter = employeeProfile.supporterId === user?.id;
      return isSupervisor || isSupporter;
    }
    return false;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Draft': return <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Draft</span>;
      case 'Submitted': return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Submitted</span>;
      case 'Supervisor Completed': return <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Supervisor Rated</span>;
      case 'Completed': return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Completed</span>;
      case 'Approved': return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">Approved</span>;
      default: return <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
            ម៉ូឌុលវាយតម្លៃខ្លួនឯង / Self-Evaluation Module
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Fill, submit, and review your performance evaluations dynamically based on role guidelines.
          </p>
        </div>

        {activeTab !== 'form' && (
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('my-evals')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'my-evals' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
            >
              My Evaluations ({myEvals.length})
            </button>
            {(user?.role === 'superadmin' || user?.role === 'admin' || subordinateEvals.length > 0) && (
              <button
                onClick={() => setActiveTab('subordinate-evals')}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'subordinate-evals' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
              >
                Team Evaluations ({subordinateEvals.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* STEP 1 & 2: Main Select Dashboard or lists */}
      {activeTab === 'my-evals' && (
        <div className="space-y-10">
          {/* Position Card Selection Dashboard */}
          <div className="space-y-6">
            <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                ជំហានទី ១៖ ជ្រើសរើសតួនាទី / Step 1: Select Your Position Card
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Select your position to automatically load your weighting scheme and performance criteria set.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {(positionForms.length > 0 ? positionForms.filter(pf => pf.status === 'Active').map(pf => pf.positionName) : PREDEFINED_POSITIONS).map(pos => {
                const applicableSecs = getSectionsForPosition(pos);
                const applicableCrits = getCriteriaForPosition(pos);
                const isMyOfficial = pos.toLowerCase() === officialPosition.toLowerCase();

                return (
                  <div
                    key={pos}
                    onClick={() => handleSelectPosition(pos)}
                    className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 rounded-2xl p-5 relative shadow-sm cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:scale-[1.02] flex flex-col justify-between min-h-[160px]"
                  >
                    {/* Click Indicator Top-Right */}
                    <div className="absolute top-5 right-5 text-slate-300 group-hover:text-indigo-500 transition-colors">
                      <ChevronRight size={18} />
                    </div>

                    {/* Top block */}
                    <div className="flex gap-4 items-start">
                      {/* Left icon wrapper */}
                      <div className="w-12 h-12 bg-purple-50 dark:bg-purple-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110">
                        {getPositionIcon(pos)}
                      </div>

                      {/* Info */}
                      <div className="space-y-1 pr-6">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {pos}
                          </h3>
                          {isMyOfficial && (
                            <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                              Your Profile
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Active evaluation package
                        </p>
                      </div>
                    </div>

                    {/* Bottom block metadata */}
                    <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-700/50 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-bold">
                        <span>{applicableSecs.length} Sections</span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span>{applicableCrits.length} Criteria</span>
                      </div>
                      <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider">
                        Published
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Previous Evals history full-width list */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">ប្រវត្តិវាយតម្លៃខ្លួនឯង / My Self-Evaluation History</h3>
              <span className="text-xs text-slate-500 font-bold bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
                {myEvals.length} Records
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-700 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Position</th>
                    <th className="px-6 py-4">Period</th>
                    <th className="px-6 py-4 text-center">Self Score</th>
                    <th className="px-6 py-4 text-center">Overall</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {myEvals.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-all">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{ev.position}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{ev.campus}</div>
                      </td>
                      <td className="px-6 py-4 font-bold">{ev.evalPeriod}</td>
                      <td className="px-6 py-4 text-center font-extrabold text-slate-800 dark:text-slate-100">{ev.totalSelfScore}</td>
                      <td className="px-6 py-4 text-center font-extrabold text-indigo-600 dark:text-indigo-400">{ev.overallScore}%</td>
                      <td className="px-6 py-4 text-center">{getStatusBadge(ev.status)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditEval(ev, true)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600"
                            title="View evaluation"
                          >
                            <Eye size={16} />
                          </button>
                          {(ev.status === 'Draft') && (
                            <button
                              onClick={() => handleEditEval(ev, false)}
                              className="p-1.5 text-slate-400 hover:text-blue-600"
                              title="Edit evaluation"
                            >
                              <Edit2 size={16} />
                            </button>
                          )}
                          {(user?.role === 'superadmin' || user?.role === 'admin') && (
                            <button
                              onClick={() => handleDeleteEval(ev.id!)}
                              className="p-1.5 text-slate-400 hover:text-red-500"
                              title="Delete evaluation"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {myEvals.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-bold">No evaluation record history found. Select a position above to start your first evaluation!</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBORDINATES/TEAM EVALUATIONS LIST */}
      {activeTab === 'subordinate-evals' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">ការវាយតម្លៃក្រុមការងារ / Subordinate Team Evaluations</h3>
            <p className="text-xs text-slate-400 mt-0.5">Rate or review self-evaluations submitted by your team members.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-700 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Position</th>
                  <th className="px-6 py-4">Campus/Dept</th>
                  <th className="px-6 py-4 text-center">Self Score</th>
                  <th className="px-6 py-4 text-center">Overall</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {subordinateEvals.map((ev) => {
                  const empProf = employees.find(e => e.id === ev.employeeId);
                  const isSupervisor = empProf?.supervisorId === user?.id || user?.role === 'superadmin' || user?.role === 'admin';
                  const isSupporter = empProf?.supporterId === user?.id || user?.role === 'superadmin' || user?.role === 'admin';

                  return (
                    <tr key={ev.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-all">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100">{ev.employeeName}</div>
                        <div className="text-[10px] text-slate-400 font-medium">ID: {ev.employeeId}</div>
                      </td>
                      <td className="px-6 py-4 font-bold">{ev.position}</td>
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-700 dark:text-slate-300 font-bold">{ev.campus}</div>
                        <div className="text-[10px] text-slate-400">{ev.department}</div>
                      </td>
                      <td className="px-6 py-4 text-center font-bold">{ev.totalSelfScore}</td>
                      <td className="px-6 py-4 text-center font-extrabold text-indigo-600 dark:text-indigo-400">{ev.overallScore}%</td>
                      <td className="px-6 py-4 text-center">{getStatusBadge(ev.status)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditEval(ev, true)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600"
                            title="View detail report"
                          >
                            <Eye size={16} />
                          </button>
                          {/* Enable Rating buttons for supervisors and supporters depending on workflow status */}
                          {((ev.status === 'Submitted' && isSupervisor) ||
                            (ev.status === 'Supervisor Completed' && isSupporter) ||
                            (user?.role === 'superadmin' || user?.role === 'admin')) && (
                              <button
                                onClick={() => handleEditEval(ev, false)}
                                className="px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 font-extrabold text-xs rounded transition-all flex items-center gap-1"
                              >
                                <Edit2 size={12} /> Rate Now
                              </button>
                          )}
                          {(user?.role === 'superadmin' || user?.role === 'admin') && (
                            <button
                              onClick={() => handleDeleteEval(ev.id!)}
                              className="p-1.5 text-slate-400 hover:text-red-500"
                              title="Delete evaluation record"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {subordinateEvals.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold">No subordinates self-evaluation record history found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DYNAMIC FORM SCREEN */}
      {activeTab === 'form' && (
        <div className="space-y-8">
          {/* Form Control Top Bar */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400">Position Form: {selectedPosition}</span>
                {getStatusBadge(currentEval.status || 'Draft')}
              </div>
              <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-lg mt-2">{currentEval.employeeName} ({currentEval.employeeId})</h2>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-4">
                <span>Campus: <b>{currentEval.campus}</b></span>
                <span>Department: <b>{currentEval.department}</b></span>
                <span>Period: <b>{currentEval.evalPeriod}</b></span>
                <span>Workflow Model: <b>{currentEval.weightScheme}</b></span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('my-evals')}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl"
              >
                Close / Back
              </button>

              {!isViewOnly && (
                <>
                  {/* Draft Save */}
                  <button
                    type="button"
                    onClick={() => handleFormAction('save')}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl"
                  >
                    <Save size={14} /> Save Draft
                  </button>

                  {/* Submission triggers based on active role */}
                  {currentEval.status === 'Draft' && (
                    <button
                      type="button"
                      onClick={() => handleFormAction('submit')}
                      disabled={!isPositionMatched}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl disabled:opacity-50"
                    >
                      <CheckCircle size={14} /> Submit Self-Eval
                    </button>
                  )}

                  {currentEval.status === 'Submitted' && (
                    <button
                      type="button"
                      onClick={() => handleFormAction('supervisor-submit')}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
                    >
                      <CheckCircle size={14} /> Submit Supervisor Scores
                    </button>
                  )}

                  {currentEval.status === 'Supervisor Completed' && (
                    <button
                      type="button"
                      onClick={() => handleFormAction('supporter-submit')}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
                    >
                      <CheckCircle size={14} /> Submit Supporter Scores
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Validation Failure banner */}
          {!isPositionMatched && (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 dark:bg-rose-500/5 dark:border-rose-500/20 dark:text-rose-400 p-5 rounded-2xl flex gap-3 items-start">
              <AlertTriangle className="mt-0.5 text-rose-500" />
              <div>
                <h4 className="font-extrabold text-sm">បដិសេធសិទ្ធិបញ្ជូន / Submission Prevented</h4>
                <p className="text-xs mt-1">
                  You are currently attempting to fill a self-evaluation form for position <b>{selectedPosition}</b>, which does not match your official profile position: <b>"{officialPosition || 'None'}"</b>. You are prevented from saving or submitting this self-evaluation form.
                </p>
              </div>
            </div>
          )}

          {/* Comment/Justification requirements banner */}
          {!isViewOnly && currentEval.status === 'Draft' && (
            <div className="bg-amber-50 border border-amber-100 text-amber-800 dark:bg-amber-500/5 dark:border-amber-500/20 dark:text-amber-400 p-4 rounded-2xl flex gap-3 items-start">
              <HelpCircle className="mt-0.5 text-amber-500" />
              <div>
                <h4 className="font-bold text-xs">តម្រូវការយុត្តិកម្ម / Justification Requirement</h4>
                <p className="text-[11px] mt-0.5">
                  You are required to write a comment / justification under <b>every scored criterion</b>. The system will prevent submission if any score has no justification text.
                </p>
              </div>
            </div>
          )}

          {/* SECTIONS AND CRITERIA RENDERING */}
          <div className="space-y-8">
            {getSectionsForPosition(selectedPosition, currentEval)
              .map((section) => {
                const sectionCriteria = getCriteriaForPosition(selectedPosition, currentEval).filter(c => c.sectionId === section.id);
                if (sectionCriteria.length === 0) return null;

                return (
                  <div key={section.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {/* Section Header */}
                    <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex justify-between items-center">
                      <div>
                        <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">{section.nameKh}</h3>
                        <h4 className="text-xs text-slate-500 dark:text-slate-400 font-medium">{section.nameEn}</h4>
                      </div>
                      <span className="font-bold text-xs bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 px-3 py-1.5 rounded-lg">
                        Weight: {section.weight}%
                      </span>
                    </div>

                    {/* Criteria items list inside section */}
                    <div className="p-6 divide-y divide-slate-100 dark:divide-slate-700/50 space-y-6">
                      {sectionCriteria.map((crit, idx) => {
                        const scoreData = formScores[crit.id] || { selfScore: 0, selfComment: '', superScore: 0, superComment: '', supporterScore: 0, supporterComment: '' };

                        // Check roles and statuses for write/read states
                        const canEditSelfScore = !isViewOnly && (user?.role === 'superadmin' || user?.role === 'admin' || (currentEval.status === 'Draft' && user?.id === currentEval.employeeId));
                        const canEditSuperScore = !isViewOnly && (user?.role === 'superadmin' || user?.role === 'admin' || (currentEval.status === 'Submitted'));
                        const canEditSupporterScore = !isViewOnly && (user?.role === 'superadmin' || user?.role === 'admin' || (currentEval.status === 'Supervisor Completed'));

                        return (
                          <div key={crit.id} className={`pt-6 ${idx === 0 ? 'pt-0' : ''} space-y-4`}>
                            {/* Criterion title */}
                            <div className="flex justify-between items-start gap-4">
                              <div className="space-y-1">
                                <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
                                  {idx + 1}. {crit.nameKh}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                  {crit.nameEn}
                                </p>
                              </div>
                              <span className="text-xs font-bold text-slate-400">Max possible score: {crit.maxScore || 10}</span>
                            </div>

                            {/* Scores & Comments entry panel */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                              {/* 1. Self Score */}
                              <div className="space-y-2 bg-slate-50/50 dark:bg-slate-900/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-center">
                                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Self Evaluation Score</label>
                                  <span className="text-[11px] text-slate-400">Max: {crit.maxScore || 10}</span>
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  max={crit.maxScore || 10}
                                  disabled={!canEditSelfScore}
                                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500 text-center"
                                  value={scoreData.selfScore}
                                  onChange={e => handleScoreChange(crit.id, 'selfScore', Math.min(crit.maxScore || 10, Math.max(0, Number(e.target.value))))}
                                />
                                <div className="pt-2">
                                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Written Justification *</label>
                                  <textarea
                                    rows={2}
                                    disabled={!canEditSelfScore}
                                    placeholder="Write written justification..."
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 resize-none"
                                    value={scoreData.selfComment}
                                    onChange={e => handleCommentChange(crit.id, 'selfComment', e.target.value)}
                                  />
                                  {!scoreData.selfComment.trim() && scoreData.selfScore > 0 && (
                                    <span className="text-[9px] font-bold text-rose-500 mt-1 block">⚠️ Written justification required!</span>
                                  )}
                                </div>
                              </div>

                              {/* 2. Direct Supervisor Score */}
                              <div className="space-y-2 bg-slate-50/50 dark:bg-slate-900/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-center">
                                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Supervisor Score</label>
                                  <span className="text-[11px] text-slate-400">Max: {crit.maxScore || 10}</span>
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  max={crit.maxScore || 10}
                                  disabled={!canEditSuperScore}
                                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500 text-center"
                                  value={scoreData.superScore}
                                  onChange={e => handleScoreChange(crit.id, 'superScore', Math.min(crit.maxScore || 10, Math.max(0, Number(e.target.value))))}
                                />
                                <div className="pt-2">
                                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Supervisor Notes</label>
                                  <textarea
                                    rows={2}
                                    disabled={!canEditSuperScore}
                                    placeholder="Add feedback/notes..."
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 resize-none"
                                    value={scoreData.superComment}
                                    onChange={e => handleCommentChange(crit.id, 'superComment', e.target.value)}
                                  />
                                </div>
                              </div>

                              {/* 3. Supporter Score */}
                              <div className="space-y-2 bg-slate-50/50 dark:bg-slate-900/20 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-center">
                                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Supporter Score</label>
                                  <span className="text-[11px] text-slate-400">Max: {crit.maxScore || 10}</span>
                                </div>
                                <input
                                  type="number"
                                  min="0"
                                  max={crit.maxScore || 10}
                                  disabled={!canEditSupporterScore}
                                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold focus:ring-2 focus:ring-indigo-500 text-center"
                                  value={scoreData.supporterScore}
                                  onChange={e => handleScoreChange(crit.id, 'supporterScore', Math.min(crit.maxScore || 10, Math.max(0, Number(e.target.value))))}
                                />
                                <div className="pt-2">
                                  <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Supporter Notes</label>
                                  <textarea
                                    rows={2}
                                    disabled={!canEditSupporterScore}
                                    placeholder="Add supporter feedback..."
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 resize-none"
                                    value={scoreData.supporterComment}
                                    onChange={e => handleCommentChange(crit.id, 'supporterComment', e.target.value)}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
