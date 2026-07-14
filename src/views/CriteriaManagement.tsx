import { apiFetch } from '../mockApi';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDynamicCriteria, EvaluationSection, EvaluationCriterion, PREDEFINED_POSITIONS } from '../hooks/useSettings';
import { Save, Plus, Trash2, Settings, List, PlusCircle, Check, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CriteriaManagement() {
  const { user } = useAuth();
  const { sections, criteria, loading, saveAll } = useDynamicCriteria();

  const [localSections, setLocalSections] = useState<EvaluationSection[]>([]);
  const [localCriteria, setLocalCriteria] = useState<EvaluationCriterion[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Form states for Section editing/adding
  const [isEditingSection, setIsEditingSection] = useState(false);
  const [editingSection, setEditingSection] = useState<Partial<EvaluationSection>>({});

  // Form states for Criterion editing/adding
  const [isEditingCriterion, setIsEditingCriterion] = useState(false);
  const [editingCriterion, setEditingCriterion] = useState<Partial<EvaluationCriterion>>({});

  useEffect(() => {
    if (sections && sections.length > 0) {
      setLocalSections(JSON.parse(JSON.stringify(sections)));
      if (!selectedSectionId) {
        setSelectedSectionId(sections[0].id);
      }
    }
  }, [sections]);

  useEffect(() => {
    if (criteria) {
      setLocalCriteria(JSON.parse(JSON.stringify(criteria)));
    }
  }, [criteria]);

  if (loading) {
    return <div className="p-12 text-center font-bold text-slate-500 dark:text-slate-400">Loading Configuration...</div>;
  }

  const handleSave = async () => {
    setSaving(true);
    const success = await saveAll(localSections, localCriteria);
    setSaving(false);
    if (success) {
      toast.success('Configuration saved successfully!');
    } else {
      toast.error('Failed to save configuration.');
    }
  };

  const handleAddSection = () => {
    const id = 'sec_' + Date.now();
    const newSec: EvaluationSection = {
      id,
      nameKh: 'ផ្នែកថ្មី',
      nameEn: 'New Section',
      weight: 10,
      order: localSections.length + 1,
      status: 'Active',
      positions: [...PREDEFINED_POSITIONS]
    };
    setLocalSections([...localSections, newSec]);
    setSelectedSectionId(id);
    toast.success('Section added! Fill details and save.');
  };

  const handleDeleteSection = (id: string) => {
    if (confirm('Are you sure you want to delete this section and all of its criteria?')) {
      const newSecs = localSections.filter(s => s.id !== id);
      const newCrits = localCriteria.filter(c => c.sectionId !== id);
      setLocalSections(newSecs);
      setLocalCriteria(newCrits);
      if (selectedSectionId === id) {
        setSelectedSectionId(newSecs[0]?.id || '');
      }
      toast.success('Section deleted');
    }
  };

  const handleAddCriterion = () => {
    if (!selectedSectionId) {
      toast.error('Please select or create a Section first.');
      return;
    }
    const id = 'crit_' + Date.now();
    const newCrit: EvaluationCriterion = {
      id,
      nameKh: 'លក្ខណៈវិនិច្ឆ័យថ្មី',
      nameEn: 'New Criterion',
      sectionId: selectedSectionId,
      positions: [...PREDEFINED_POSITIONS],
      maxScore: 10,
      order: localCriteria.filter(c => c.sectionId === selectedSectionId).length + 1,
      status: 'Active'
    };
    setLocalCriteria([...localCriteria, newCrit]);
    toast.success('Criterion added! Edit its fields and save.');
  };

  const handleDeleteCriterion = (id: string) => {
    if (confirm('Are you sure you want to delete this criterion?')) {
      setLocalCriteria(localCriteria.filter(c => c.id !== id));
      toast.success('Criterion deleted');
    }
  };

  const updateSectionField = (secId: string, field: keyof EvaluationSection, value: any) => {
    setLocalSections(localSections.map(s => s.id === secId ? { ...s, [field]: value } : s));
  };

  const updateCriterionField = (critId: string, field: keyof EvaluationCriterion, value: any) => {
    setLocalCriteria(localCriteria.map(c => c.id === critId ? { ...c, [field]: value } : c));
  };

  const toggleSectionPosition = (secId: string, pos: string) => {
    const sec = localSections.find(s => s.id === secId);
    if (!sec) return;
    const isAssigned = sec.positions.includes(pos);
    const newPositions = isAssigned 
      ? sec.positions.filter(p => p !== pos)
      : [...sec.positions, pos];
    updateSectionField(secId, 'positions', newPositions);
  };

  const toggleCriterionPosition = (critId: string, pos: string) => {
    const crit = localCriteria.find(c => c.id === critId);
    if (!crit) return;
    const isAssigned = crit.positions.includes(pos);
    const newPositions = isAssigned 
      ? crit.positions.filter(p => p !== pos)
      : [...crit.positions, pos];
    updateCriterionField(critId, 'positions', newPositions);
  };

  const selectedSection = localSections.find(s => s.id === selectedSectionId);
  const currentSectionCriteria = localCriteria.filter(c => c.sectionId === selectedSectionId);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">
            រៀបចំផ្នែក និងលក្ខណៈវិនិច្ឆ័យវាយតម្លៃ
          </h1>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Dynamic Sections & Criteria Management (Super Administrator)
          </p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-colors active:scale-95 disabled:opacity-50"
          id="btn-save-criteria-config"
        >
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sections Sidebar (4 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
            <div>
              <h2 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">ផ្នែកវាយតម្លៃ / Evaluation Sections</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Manage evaluation blocks and weightings</p>
            </div>
            <button 
              onClick={handleAddSection} 
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-bold text-xs rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
              id="btn-add-section"
            >
              <Plus size={14} /> Add Section
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {localSections.map((sec) => (
              <div 
                key={sec.id}
                onClick={() => setSelectedSectionId(sec.id)}
                className={`p-4 rounded-xl cursor-pointer transition-all border ${
                  selectedSectionId === sec.id 
                    ? 'bg-indigo-50/50 dark:bg-indigo-500/5 border-indigo-200 dark:border-indigo-500/30' 
                    : 'border-transparent hover:bg-slate-50/50 dark:hover:bg-slate-700/20'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Section Order {sec.order}</span>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{sec.nameKh}</h3>
                    <h4 className="text-xs text-slate-500 dark:text-slate-400 font-medium">{sec.nameEn}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${sec.status === 'Active' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10'}`}>
                      {sec.status}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteSection(sec.id); }} 
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors"
                      id={`btn-delete-section-${sec.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Weights and Positions summary */}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <div className="bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg font-bold text-slate-700 dark:text-slate-300">
                    Weight: {sec.weight}%
                  </div>
                  <div>
                    Positions: <span className="font-bold text-slate-700 dark:text-slate-300">{sec.positions.length} selected</span>
                  </div>
                </div>
              </div>
            ))}

            {localSections.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm font-medium">No sections found. Click Add to create one.</div>
            )}
          </div>
        </div>

        {/* Section Editor & Criteria list (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedSection ? (
            <>
              {/* Section Editor Card */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base mb-6 border-b border-slate-100 dark:border-slate-700 pb-3">
                  កែប្រែព័ត៌មានផ្នែក / Edit Section Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Khmer Section Name</label>
                    <input 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={selectedSection.nameKh} 
                      onChange={e => updateSectionField(selectedSection.id, 'nameKh', e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">English Section Name</label>
                    <input 
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={selectedSection.nameEn} 
                      onChange={e => updateSectionField(selectedSection.id, 'nameEn', e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Weight (%)</label>
                    <input 
                      type="number"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                      value={selectedSection.weight} 
                      onChange={e => updateSectionField(selectedSection.id, 'weight', Number(e.target.value))} 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Display Order</label>
                      <input 
                        type="number"
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedSection.order} 
                        onChange={e => updateSectionField(selectedSection.id, 'order', Number(e.target.value))} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
                      <select 
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedSection.status} 
                        onChange={e => updateSectionField(selectedSection.id, 'status', e.target.value as any)}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section Position selection */}
                <div className="mt-6 border-t border-slate-100 dark:border-slate-700 pt-5">
                  <div className="flex justify-between items-center mb-3">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Assigned Positions / តួនាទីត្រូវបានចាត់តាំង
                    </label>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => updateSectionField(selectedSection.id, 'positions', [...PREDEFINED_POSITIONS])}
                        className="text-[10px] font-bold text-indigo-600 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-[10px] text-slate-300">|</span>
                      <button 
                        type="button" 
                        onClick={() => updateSectionField(selectedSection.id, 'positions', [])}
                        className="text-[10px] font-bold text-rose-500 hover:underline"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {PREDEFINED_POSITIONS.map(pos => {
                      const isChecked = selectedSection.positions.includes(pos);
                      return (
                        <button
                          key={pos}
                          type="button"
                          onClick={() => toggleSectionPosition(selectedSection.id, pos)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-bold transition-all ${
                            isChecked 
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-indigo-400' 
                              : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded flex items-center justify-center border ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                            {isChecked && <Check size={10} />}
                          </div>
                          <span className="truncate">{pos}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Criteria List for Selected Section */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                  <div>
                    <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">លក្ខណៈវិនិច្ឆ័យក្នុងផ្នែកនេះ / Section Criteria</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">Manage score metrics within this section block</p>
                  </div>
                  <button 
                    onClick={handleAddCriterion} 
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-bold text-xs rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
                    id="btn-add-criterion"
                  >
                    <Plus size={14} /> Add Criterion
                  </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                  {currentSectionCriteria.map((crit) => (
                    <div key={crit.id} className="p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/20 dark:bg-slate-900/10 space-y-4">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Criterion Name (Khmer)</label>
                            <input 
                              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                              value={crit.nameKh} 
                              onChange={e => updateCriterionField(crit.id, 'nameKh', e.target.value)} 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Criterion Name (English)</label>
                            <input 
                              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                              value={crit.nameEn} 
                              onChange={e => updateCriterionField(crit.id, 'nameEn', e.target.value)} 
                            />
                          </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteCriterion(crit.id)}
                          className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                          id={`btn-delete-criterion-${crit.id}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Max Score</label>
                          <input 
                            type="number"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                            value={crit.maxScore} 
                            onChange={e => updateCriterionField(crit.id, 'maxScore', Number(e.target.value))} 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Display Order</label>
                          <input 
                            type="number"
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                            value={crit.order} 
                            onChange={e => updateCriterionField(crit.id, 'order', Number(e.target.value))} 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wide mb-1">Status</label>
                          <select 
                            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
                            value={crit.status} 
                            onChange={e => updateCriterionField(crit.id, 'status', e.target.value as any)}
                          >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                          </select>
                        </div>
                      </div>

                      {/* Position selection for single criterion */}
                      <div className="border-t border-slate-100 dark:border-slate-700/50 pt-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase">Criterion Positions</span>
                          <div className="flex gap-2">
                            <button 
                              type="button" 
                              onClick={() => updateCriterionField(crit.id, 'positions', [...PREDEFINED_POSITIONS])}
                              className="text-[9px] font-bold text-indigo-600 hover:underline"
                            >
                              Select All
                            </button>
                            <span className="text-[9px] text-slate-300">|</span>
                            <button 
                              type="button" 
                              onClick={() => updateCriterionField(crit.id, 'positions', [])}
                              className="text-[9px] font-bold text-rose-500 hover:underline"
                            >
                              Deselect All
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {PREDEFINED_POSITIONS.map(p => {
                            const active = crit.positions.includes(p);
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => toggleCriterionPosition(crit.id, p)}
                                className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                                  active 
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-indigo-400' 
                                    : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-100'
                                }`}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}

                  {currentSectionCriteria.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-sm font-medium">No criteria in this section. Click Add Criterion to start.</div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400 font-bold h-64 flex items-center justify-center">
              Select or create an evaluation section from the left sidebar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
