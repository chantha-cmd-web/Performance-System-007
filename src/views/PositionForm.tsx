import React, { useState, useEffect } from 'react';
import { apiFetch } from '../mockApi';
import { useAuth } from '../contexts/AuthContext';
import { PREDEFINED_POSITIONS } from '../hooks/useSettings';
import { EVALUATION_TYPES } from '../types';
import { 
  Briefcase, 
  Plus, 
  Trash2, 
  Copy, 
  Save, 
  ChevronDown, 
  ChevronUp, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  Layers, 
  FileText, 
  Check, 
  AlertTriangle,
  FolderPlus,
  Settings,
  HelpCircle,
  Menu,
  CheckCircle,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface PositionSection {
  id: string;
  nameKh: string;
  nameEn: string;
  order: number;
}

export interface PositionCriterion {
  id: string;
  nameKh: string;
  nameEn: string;
  maxScore: number;
  sectionId: string; // empty string for uncategorized
  order: number;
}

export interface PositionFormConfig {
  id: string; // unique ID, usually lowercased/dashed position name
  positionName: string;
  weightScheme: string;
  status: 'Active' | 'Draft';
  sections: PositionSection[];
  criteria: PositionCriterion[];
  evaluationType?: string;
}

const WEIGHTING_SCHEMES = [
  { id: 'campus_60_40', label: 'Direct Supervisor 60% (Campus) / Supporter 40% (Central)' },
  { id: 'campus_50_50', label: 'Direct Supervisor 50% (Campus) / Supporter 50% (Central)' },
  { id: 'campus_100', label: 'Direct Supervisor (Campus) 100%' },
  { id: 'central_100', label: 'Direct Supervisor 100% (Central)' },
  { id: 'management_100', label: 'Management 100%' },
  { id: 'asp_100', label: 'ASP 100%' }
];

export default function PositionForm() {
  const { user, token } = useAuth();
  const [positions, setPositions] = useState<PositionFormConfig[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPositionId, setSelectedPositionId] = useState<string>('');
  
  // Local state for current edited template
  const [currentPosition, setCurrentPosition] = useState<PositionFormConfig | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  
  // UI creation modals or quick forms
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [newPositionName, setNewPositionName] = useState('');
  const [newPositionWeightScheme, setNewPositionWeightScheme] = useState('campus_60_40');
  const [newPositionEvaluationType, setNewPositionEvaluationType] = useState('operations');
  
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSectionKh, setNewSectionKh] = useState('');
  const [newSectionEn, setNewSectionEn] = useState('');

  const [showAddCriterionModal, setShowAddCriterionModal] = useState(false);
  const [newCritKh, setNewCritKh] = useState('');
  const [newCritEn, setNewCritEn] = useState('');
  const [newCritMaxScore, setNewCritMaxScore] = useState<number>(10);
  const [newCritSectionId, setNewCritSectionId] = useState<string>('');

  // Drag and Drop drag item state
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [draggedCriterionId, setDraggedCriterionId] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    fetchData();
  }, [token]);

  const fetchData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [posRes, empRes] = await Promise.all([
        apiFetch('/api/settings/position_forms', { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch('/api/employees', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      let posData: PositionFormConfig[] = [];
      if (posRes.ok) {
        const d = await posRes.json();
        posData = Array.isArray(d) ? d : [];
      }

      if (empRes.ok) {
        const emps = await empRes.json();
        setEmployees(Array.isArray(emps) ? emps : []);
      }

      // If absolutely empty database, seed positions from PREDEFINED_POSITIONS and fallback templates
      if (posData.length === 0) {
        posData = await seedDefaultPositionForms();
      }

      setPositions(posData);
      if (posData.length > 0) {
        setSelectedPositionId(posData[0].id);
        setCurrentPosition(JSON.parse(JSON.stringify(posData[0])));
      }
    } catch (e) {
      console.error('Error fetching position forms config', e);
      toast.error('Failed to load position configuration.');
    } finally {
      setLoading(false);
    }
  };

  const seedDefaultPositionForms = async () => {
    // Let's seed default position forms dynamically using the existing global sections and criteria
    try {
      const [secRes, critRes] = await Promise.all([
        apiFetch('/api/settings/evaluation_sections', { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch('/api/settings/evaluation_criteria', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      let rawSecs: any[] = [];
      let rawCrits: any[] = [];

      if (secRes.ok) rawSecs = await secRes.json();
      if (critRes.ok) rawCrits = await critRes.json();

      // If those are also empty, use mock values to populate
      const seeded: PositionFormConfig[] = PREDEFINED_POSITIONS.map(pos => {
        const id = pos.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        // Filter global sections/criteria that are applicable to this position
        const applicableSecs = Array.isArray(rawSecs) 
          ? rawSecs.filter(s => s.positions?.includes(pos)) 
          : [];
        const applicableCrits = Array.isArray(rawCrits) 
          ? rawCrits.filter(c => c.positions?.includes(pos)) 
          : [];

        // Map sections
        const mappedSecs: PositionSection[] = applicableSecs.map((s, idx) => ({
          id: s.id,
          nameKh: s.nameKh,
          nameEn: s.nameEn,
          order: s.order || (idx + 1)
        }));

        // Map criteria
        const mappedCrits: PositionCriterion[] = applicableCrits.map((c, idx) => ({
          id: c.id,
          nameKh: c.nameKh || '',
          nameEn: c.nameEn || '',
          maxScore: c.maxScore || 10,
          sectionId: c.sectionId || '',
          order: c.order || (idx + 1)
        }));

        // Default sections and criteria if nothing is available
        const finalSecs = mappedSecs.length > 0 ? mappedSecs : [
          { id: 'sec_1', nameKh: 'អាកប្បកិរិយា និងក្រមសីលធម៌', nameEn: 'Attitude & Conduct', order: 1 },
          { id: 'sec_2', nameKh: 'ចំណេះដឹង និងគុណភាពការងារ', nameEn: 'Professional Competence & Quality', order: 2 },
          { id: 'sec_3', nameKh: 'ទំនាក់ទំនង និងការធ្វើការងារជាក្រុម', nameEn: 'Teamwork & Communication', order: 3 },
          { id: 'sec_4', nameKh: 'ការគ្រប់គ្រង និងវិន័យ', nameEn: 'Responsibility & Discipline', order: 4 }
        ];

        const finalCrits = mappedCrits.length > 0 ? mappedCrits : [
          { id: 'crit_1', nameKh: 'ការគោរពវិន័យ និងម៉ោងធ្វើការ', nameEn: 'Discipline and working hours', maxScore: 10, sectionId: 'sec_1', order: 1 },
          { id: 'crit_2', nameKh: 'ភាពស្មោះត្រង់ និងក្រមសីលធម៌វិជ្ជាជីវៈ', nameEn: 'Integrity and professional ethics', maxScore: 10, sectionId: 'sec_1', order: 2 },
          { id: 'crit_3', nameKh: 'ការយល់ដឹងពីភារកិច្ច និងជំនាញការងារ', nameEn: 'Understanding of duties and work skills', maxScore: 10, sectionId: 'sec_2', order: 1 },
          { id: 'crit_4', nameKh: 'ប្រសិទ្ធភាព និងភាពត្រឹមត្រូវនៃការងារ', nameEn: 'Efficiency and accuracy of work', maxScore: 10, sectionId: 'sec_2', order: 2 },
          { id: 'crit_5', nameKh: 'ការសហការល្អជាមួយសហការី និងថ្នាក់ដឹកនាំ', nameEn: 'Good cooperation with colleagues and leaders', maxScore: 10, sectionId: 'sec_3', order: 1 },
          { id: 'crit_6', nameKh: 'ការទំនាក់ទំនង និងបដិសណ្ឋារកិច្ច', nameEn: 'Communication and hospitality', maxScore: 10, sectionId: 'sec_3', order: 2 },
          { id: 'crit_7', nameKh: 'គំនិតផ្តួចផ្តើម និងការដោះស្រាយបញ្ហា', nameEn: 'Initiative and problem solving', maxScore: 10, sectionId: 'sec_4', order: 1 },
          { id: 'crit_8', nameKh: 'ការទទួលខុសត្រូវខ្ពស់លើការងារ', nameEn: 'High responsibility for work', maxScore: 10, sectionId: 'sec_4', order: 2 }
        ];

        // Determine default weighting scheme
        let defaultScheme = 'campus_60_40';
        if (pos === 'Central Officer') defaultScheme = 'central_100';
        else if (pos === 'Management') defaultScheme = 'management_100';
        else if (pos === 'Administrator') defaultScheme = 'campus_100';

        // Determine default evaluation type
        let evalType = 'operations';
        const lowerPos = pos.toLowerCase();
        if (lowerPos.includes('teacher') || lowerPos.includes('ta') || lowerPos.includes('teaching')) {
          evalType = 'teacher';
        } else if (lowerPos.includes('management') || lowerPos.includes('chief') || lowerPos.includes('director') || lowerPos.includes('manager') || lowerPos.includes('supervisor')) {
          evalType = 'management';
        }

        return {
          id,
          positionName: pos,
          weightScheme: defaultScheme,
          evaluationType: evalType,
          status: 'Active' as const,
          sections: finalSecs,
          criteria: finalCrits
        };
      });

      // Save to server
      await apiFetch('/api/settings/position_forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(seeded)
      });

      return seeded;
    } catch (e) {
      console.error('Seeding position forms failed, using static fallback.', e);
      return [];
    }
  };

  // Helper to save positions configuration to backend and state
  const savePositionsToDb = async (updatedPositions: PositionFormConfig[]) => {
    try {
      const res = await apiFetch('/api/settings/position_forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updatedPositions)
      });
      if (res.ok) {
        setPositions(updatedPositions);
        // Log audit trail
        apiFetch('/api/audit-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            userId: user?.id,
            userName: user?.name,
            action: 'update_position_forms',
            details: 'Automatically saved changes to Position Forms designer'
          })
        });
      } else {
        toast.error('Failed to save changes to the cloud database.');
      }
    } catch (e) {
      console.error('Error autosaving position forms', e);
    }
  };

  // Handle position selection
  const handleSelectPosition = (id: string) => {
    setSelectedPositionId(id);
    const pos = positions.find(p => p.id === id);
    if (pos) {
      setCurrentPosition(JSON.parse(JSON.stringify(pos)));
    } else {
      setCurrentPosition(null);
    }
  };

  // Triggered on any local currentPosition state change to autosave
  const triggerAutosave = (updatedPos: PositionFormConfig) => {
    setCurrentPosition(updatedPos);
    const newPositions = positions.map(p => p.id === updatedPos.id ? updatedPos : p);
    savePositionsToDb(newPositions);
  };

  // 1. ADD POSITION
  const handleAddPosition = () => {
    if (!newPositionName.trim()) {
      toast.error('Please enter a position name.');
      return;
    }

    // Prevents duplicate position names
    const exists = positions.some(p => p.positionName.toLowerCase() === newPositionName.trim().toLowerCase());
    if (exists) {
      toast.error('A position template with this name already exists.');
      return;
    }

    const id = newPositionName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newPos: PositionFormConfig = {
      id,
      positionName: newPositionName.trim(),
      weightScheme: newPositionWeightScheme,
      evaluationType: newPositionEvaluationType,
      status: 'Active',
      sections: [
        { id: 'sec_1', nameKh: 'អាកប្បកិរិយា និងក្រមសីលធម៌', nameEn: 'Attitude & Conduct', order: 1 },
        { id: 'sec_2', nameKh: 'ចំណេះដឹង និងគុណភាពការងារ', nameEn: 'Professional Competence & Quality', order: 2 }
      ],
      criteria: [
        { id: 'crit_1', nameKh: 'ការគោរពវិន័យ និងម៉ោងធ្វើការ', nameEn: 'Discipline and working hours', maxScore: 10, sectionId: 'sec_1', order: 1 },
        { id: 'crit_2', nameKh: 'ចំណេះដឹងការងារ', nameEn: 'Job Knowledge', maxScore: 10, sectionId: 'sec_2', order: 1 }
      ]
    };

    const updatedList = [...positions, newPos];
    setPositions(updatedList);
    setSelectedPositionId(id);
    setCurrentPosition(newPos);
    setShowAddPositionModal(false);
    setNewPositionName('');
    setNewPositionEvaluationType('operations');
    savePositionsToDb(updatedList);
    toast.success(`Position "${newPos.positionName}" created!`);
  };

  // 2. DUPLICATE POSITION
  const handleDuplicatePosition = (p: PositionFormConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    
    let counter = 1;
    let dupName = `${p.positionName} (Copy)`;
    let dupId = `${p.id}-copy`;
    
    while (positions.some(pos => pos.positionName.toLowerCase() === dupName.toLowerCase())) {
      counter++;
      dupName = `${p.positionName} (Copy ${counter})`;
      dupId = `${p.id}-copy-${counter}`;
    }

    const duplicated: PositionFormConfig = {
      ...JSON.parse(JSON.stringify(p)),
      id: dupId,
      positionName: dupName,
      status: 'Draft'
    };

    const updatedList = [...positions, duplicated];
    setPositions(updatedList);
    setSelectedPositionId(dupId);
    setCurrentPosition(duplicated);
    savePositionsToDb(updatedList);
    toast.success(`Duplicated "${p.positionName}" to "${dupName}"`);
  };

  // 3. DELETE POSITION
  const handleDeletePosition = (p: PositionFormConfig, e: React.MouseEvent) => {
    e.stopPropagation();

    // Prevents deleting a position if assigned to active employees, unless confirmed
    const activeAssignedEmployees = employees.filter(emp => 
      emp.position && 
      emp.position.toLowerCase() === p.positionName.toLowerCase() && 
      emp.status === 'Active'
    );

    let confirmMsg = `Are you sure you want to delete the "${p.positionName}" position template?`;
    if (activeAssignedEmployees.length > 0) {
      confirmMsg = `WARNING: The "${p.positionName}" template is currently assigned to ${activeAssignedEmployees.length} active employee(s) (e.g. ${activeAssignedEmployees.map(e => e.name).slice(0, 3).join(', ')}). \n\nAre you absolutely sure you want to delete this position template? This action is irreversible!`;
    }

    if (!confirm(confirmMsg)) {
      return;
    }

    const updatedList = positions.filter(pos => pos.id !== p.id);
    setPositions(updatedList);
    
    if (selectedPositionId === p.id) {
      if (updatedList.length > 0) {
        setSelectedPositionId(updatedList[0].id);
        setCurrentPosition(JSON.parse(JSON.stringify(updatedList[0])));
      } else {
        setSelectedPositionId('');
        setCurrentPosition(null);
      }
    }
    
    savePositionsToDb(updatedList);
    toast.success(`Position "${p.positionName}" deleted.`);
  };

  // 4. ADD SECTION
  const handleAddSection = () => {
    if (!currentPosition) return;
    if (!newSectionKh.trim() && !newSectionEn.trim()) {
      toast.error('Please enter a section name.');
      return;
    }

    // Prevents duplicate section names within the same position
    const khExists = currentPosition.sections.some(s => s.nameKh.trim().toLowerCase() === newSectionKh.trim().toLowerCase());
    const enExists = currentPosition.sections.some(s => s.nameEn.trim().toLowerCase() === newSectionEn.trim().toLowerCase());
    
    if ((newSectionKh && khExists) || (newSectionEn && enExists)) {
      toast.error('A section with this name already exists in this position.');
      return;
    }

    const secId = 'sec_' + Date.now();
    const newSec: PositionSection = {
      id: secId,
      nameKh: newSectionKh.trim() || newSectionEn.trim(),
      nameEn: newSectionEn.trim() || newSectionKh.trim(),
      order: currentPosition.sections.length + 1
    };

    const updatedPos: PositionFormConfig = {
      ...currentPosition,
      sections: [...currentPosition.sections, newSec]
    };

    triggerAutosave(updatedPos);
    setShowAddSectionModal(false);
    setNewSectionKh('');
    setNewSectionEn('');
    toast.success('Section added successfully!');
  };

  // 5. EDIT SECTION NAME
  const handleEditSectionName = (secId: string, field: 'nameKh' | 'nameEn', val: string) => {
    if (!currentPosition) return;

    const updatedSections = currentPosition.sections.map(s => {
      if (s.id === secId) {
        return { ...s, [field]: val };
      }
      return s;
    });

    triggerAutosave({
      ...currentPosition,
      sections: updatedSections
    });
  };

  // 6. DELETE SECTION
  const handleDeleteSection = (secId: string) => {
    if (!currentPosition) return;

    const associatedCriteria = currentPosition.criteria.filter(c => c.sectionId === secId);
    let confirmMsg = 'Are you sure you want to delete this section?';
    if (associatedCriteria.length > 0) {
      confirmMsg = `This section contains ${associatedCriteria.length} criteria. Deleting this section will move these criteria to the "Uncategorized" section. \n\nDo you want to proceed?`;
    }

    if (!confirm(confirmMsg)) return;

    const updatedSections = currentPosition.sections.filter(s => s.id !== secId);
    // Uncategorize criteria that belonged to deleted section
    const updatedCriteria = currentPosition.criteria.map(c => {
      if (c.sectionId === secId) {
        return { ...c, sectionId: '' }; // empty means uncategorized
      }
      return c;
    });

    triggerAutosave({
      ...currentPosition,
      sections: updatedSections,
      criteria: updatedCriteria
    });
    toast.success('Section deleted.');
  };

  // 7. ADD CRITERION
  const handleAddCriterion = () => {
    if (!currentPosition) return;
    if (!newCritKh.trim() && !newCritEn.trim()) {
      toast.error('Please enter a criterion title.');
      return;
    }

    // Prevents duplicate criteria within the same section
    const secCriteria = currentPosition.criteria.filter(c => c.sectionId === newCritSectionId);
    const khExists = secCriteria.some(c => c.nameKh.trim().toLowerCase() === newCritKh.trim().toLowerCase());
    const enExists = secCriteria.some(c => c.nameEn.trim().toLowerCase() === newCritEn.trim().toLowerCase());

    if ((newCritKh && khExists) || (newCritEn && enExists)) {
      toast.error('This criterion already exists within the selected section.');
      return;
    }

    const critId = 'crit_' + Date.now();
    const newCrit: PositionCriterion = {
      id: critId,
      nameKh: newCritKh.trim() || newCritEn.trim(),
      nameEn: newCritEn.trim() || newCritKh.trim(),
      maxScore: Number(newCritMaxScore) || 10,
      sectionId: newCritSectionId,
      order: secCriteria.length + 1
    };

    const updatedPos: PositionFormConfig = {
      ...currentPosition,
      criteria: [...currentPosition.criteria, newCrit]
    };

    triggerAutosave(updatedPos);
    setShowAddCriterionModal(false);
    setNewCritKh('');
    setNewCritEn('');
    setNewCritMaxScore(10);
    setNewCritSectionId('');
    toast.success('Criterion added!');
  };

  // 8. UPDATE CRITERION DETAIL
  const handleUpdateCriterion = (critId: string, updates: Partial<PositionCriterion>) => {
    if (!currentPosition) return;

    const updatedCriteria = currentPosition.criteria.map(c => {
      if (c.id === critId) {
        return { ...c, ...updates };
      }
      return c;
    });

    triggerAutosave({
      ...currentPosition,
      criteria: updatedCriteria
    });
  };

  // 9. DELETE CRITERION
  const handleDeleteCriterion = (critId: string) => {
    if (!currentPosition) return;
    if (!confirm('Are you sure you want to delete this criterion?')) return;

    const updatedCriteria = currentPosition.criteria.filter(c => c.id !== critId);
    triggerAutosave({
      ...currentPosition,
      criteria: updatedCriteria
    });
    toast.success('Criterion deleted.');
  };

  // 10. DUPLICATE CRITERION
  const handleDuplicateCriterion = (crit: PositionCriterion) => {
    if (!currentPosition) return;

    const dupCrit: PositionCriterion = {
      ...crit,
      id: 'crit_' + Date.now(),
      nameKh: `${crit.nameKh} (ចម្លង/Copy)`,
      nameEn: `${crit.nameEn} (Copy)`,
      order: currentPosition.criteria.filter(c => c.sectionId === crit.sectionId).length + 1
    };

    const updatedPos: PositionFormConfig = {
      ...currentPosition,
      criteria: [...currentPosition.criteria, dupCrit]
    };

    triggerAutosave(updatedPos);
    toast.success('Criterion duplicated!');
  };

  // 11. REORDER SECTIONS & CRITERIA
  const moveSectionOrder = (idx: number, direction: 'up' | 'down') => {
    if (!currentPosition) return;
    const items = [...currentPosition.sections].sort((a, b) => a.order - b.order);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    
    if (targetIdx < 0 || targetIdx >= items.length) return;

    // Swap order values
    const temp = items[idx].order;
    items[idx].order = items[targetIdx].order;
    items[targetIdx].order = temp;

    // Re-index to ensure perfect 1, 2, 3 sequence
    const resorted = items.sort((a, b) => a.order - b.order).map((s, index) => ({
      ...s,
      order: index + 1
    }));

    triggerAutosave({
      ...currentPosition,
      sections: resorted
    });
  };

  const moveCriterionOrder = (critId: string, sectionId: string, direction: 'up' | 'down') => {
    if (!currentPosition) return;
    
    const secCrits = currentPosition.criteria
      .filter(c => c.sectionId === sectionId)
      .sort((a, b) => a.order - b.order);
    
    const idx = secCrits.findIndex(c => c.id === critId);
    if (idx === -1) return;

    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= secCrits.length) return;

    // Swap order values
    const temp = secCrits[idx].order;
    secCrits[idx].order = secCrits[targetIdx].order;
    secCrits[targetIdx].order = temp;

    // Map changes back to full list
    const updatedCriteria = currentPosition.criteria.map(c => {
      const changed = secCrits.find(sc => sc.id === c.id);
      return changed ? changed : c;
    });

    triggerAutosave({
      ...currentPosition,
      criteria: updatedCriteria
    });
  };

  // Collapse/Expand toggling
  const toggleSectionCollapse = (secId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [secId]: !prev[secId]
    }));
  };

  // HTML5 Drag & Drop for Section
  const handleSectionDragStart = (e: React.DragEvent, id: string) => {
    setDraggedSectionId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSectionDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedSectionId === null || draggedSectionId === id) return;
  };

  const handleSectionDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!currentPosition || draggedSectionId === null || draggedSectionId === targetId) return;

    const list = [...currentPosition.sections].sort((a, b) => a.order - b.order);
    const dragIdx = list.findIndex(s => s.id === draggedSectionId);
    const dropIdx = list.findIndex(s => s.id === targetId);

    if (dragIdx === -1 || dropIdx === -1) return;

    // Swap item positions in array
    const [draggedItem] = list.splice(dragIdx, 1);
    list.splice(dropIdx, 0, draggedItem);

    // Reassign correct consecutive order sequence
    const updatedSections = list.map((item, index) => ({
      ...item,
      order: index + 1
    }));

    triggerAutosave({
      ...currentPosition,
      sections: updatedSections
    });

    setDraggedSectionId(null);
    toast.success('Section reordered!');
  };

  // HTML5 Drag & Drop for Criterion (between or inside sections)
  const handleCritDragStart = (e: React.DragEvent, id: string) => {
    setDraggedCriterionId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCritDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCritDrop = (e: React.DragEvent, targetSectionId: string) => {
    e.preventDefault();
    if (!currentPosition || draggedCriterionId === null) return;

    const updatedCriteria = currentPosition.criteria.map(c => {
      if (c.id === draggedCriterionId) {
        // Move to target section
        return { ...c, sectionId: targetSectionId };
      }
      return c;
    });

    // Re-sort and re-index orders inside the sections
    const reordered = updatedCriteria.map((c, idx) => ({ ...c }));

    triggerAutosave({
      ...currentPosition,
      criteria: reordered
    });

    setDraggedCriterionId(null);
    toast.success('Criterion moved and reordered!');
  };

  return (
    <div className="space-y-6">
      {/* HEADER PANELS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100/30">
              <Settings size={20} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight leading-none">រចនាសម្ព័ន្ធទម្រង់តួនាទី / Position Form Builder</h1>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Dynamic evaluation templates manager & weighting designer</p>
            </div>
          </div>
        </div>
        
        {/* Actions header bar */}
        <button
          onClick={() => setShowAddPositionModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 active:scale-[0.98] transition-all shrink-0 uppercase tracking-wider"
        >
          <Plus size={16} />
          Create Position Form
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT PANEL: POSITIONS LIST */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col max-h-[85vh]">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
            <span className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">Positions ({positions.length})</span>
            <span className="text-[10px] font-bold bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded-md">Draft + Active</span>
          </div>
          
          <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 max-h-[60vh] lg:max-h-[70vh]">
            {positions.map(p => {
              const activeEmployees = employees.filter(emp => emp.position === p.positionName && emp.status === 'Active');
              const isSelected = selectedPositionId === p.id;
              
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPosition(p.id)}
                  className={`p-4 cursor-pointer transition-all flex justify-between items-center ${
                    isSelected 
                      ? 'bg-indigo-50/50 dark:bg-indigo-500/5 border-l-4 border-indigo-600' 
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                  }`}
                >
                  <div className="space-y-1.5 pr-2 truncate">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-extrabold text-sm truncate ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}>
                        {p.positionName}
                      </h3>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold ${p.status === 'Active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10'}`}>
                        {p.status}
                      </span>
                    </div>
                    <div className="flex gap-2.5 items-center text-[11px] text-slate-400 dark:text-slate-500 font-bold">
                      <span>{p.sections?.length || 0} Secs</span>
                      <span>•</span>
                      <span>{p.criteria?.length || 0} Crits</span>
                      {activeEmployees.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-indigo-500">{activeEmployees.length} Active Emps</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quick Card Controls */}
                  <div className="flex gap-1.5 items-center opacity-70 hover:opacity-100">
                    <button
                      onClick={(e) => handleDuplicatePosition(p, e)}
                      title="Duplicate Template"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDeletePosition(p, e)}
                      title="Delete Template"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {positions.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm font-bold">
                No Position Templates Available. Create one to begin.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: SELECTED POSITION INFORMATION & BUILDER */}
        <div className="lg:col-span-8 space-y-6">
          {currentPosition ? (
            <div className="space-y-6">
              
              {/* POSITION METADATA CARD */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md">Template Designer</span>
                    <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{currentPosition.positionName} Form Configuration</h2>
                  </div>
                  
                  {/* Status switcher */}
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => triggerAutosave({ ...currentPosition, status: 'Active' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentPosition.status === 'Active' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Active
                    </button>
                    <button
                      onClick={() => triggerAutosave({ ...currentPosition, status: 'Draft' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${currentPosition.status === 'Draft' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Draft
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                  {/* Position Name Editor */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Position Name</label>
                    <input
                      type="text"
                      value={currentPosition.positionName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentPosition({ ...currentPosition, positionName: val });
                      }}
                      onBlur={() => {
                        // Check validation on blur
                        if (!currentPosition.positionName.trim()) {
                          toast.error('Position name cannot be empty.');
                          return;
                        }
                        const exists = positions.some(p => p.id !== currentPosition.id && p.positionName.toLowerCase() === currentPosition.positionName.trim().toLowerCase());
                        if (exists) {
                          toast.error('Another position template already uses this name.');
                          return;
                        }
                        triggerAutosave(currentPosition);
                        toast.success('Position name updated!');
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-extrabold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Weighting Scheme Selection */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Weighting Scheme</label>
                    <select
                      value={currentPosition.weightScheme}
                      onChange={(e) => {
                        const updated = { ...currentPosition, weightScheme: e.target.value };
                        triggerAutosave(updated);
                        toast.success('Weighting scheme updated & saved!');
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {WEIGHTING_SCHEMES.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Evaluation Type Selection */}
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Evaluation Type</label>
                    <select
                      value={currentPosition.evaluationType || 'operations'}
                      onChange={(e) => {
                        const updated = { ...currentPosition, evaluationType: e.target.value };
                        triggerAutosave(updated);
                        toast.success('Evaluation type updated & saved!');
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {EVALUATION_TYPES.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* AUTOSAVE INDICATOR STATUS */}
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/5 p-3 rounded-xl border border-emerald-100/30 font-bold mt-2">
                  <CheckCircle size={14} />
                  <span>Autosave Enabled. Every adjustment is stored securely without manual saving.</span>
                </div>
              </div>

              {/* DESIGNER QUICK ACTIONS BAR */}
              <div className="flex flex-wrap justify-between items-center gap-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
                <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                  <span className="flex items-center gap-1"><Layers size={14} /> Sections: {currentPosition.sections?.length || 0}</span>
                  <span className="flex items-center gap-1"><FileText size={14} /> Criteria: {currentPosition.criteria?.length || 0}</span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAddSectionModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/30 dark:hover:bg-purple-950/50 text-purple-700 dark:text-purple-400 font-extrabold text-xs rounded-lg border border-purple-100/20 active:scale-95 transition-all"
                  >
                    <FolderPlus size={14} />
                    + Section
                  </button>
                  <button
                    onClick={() => {
                      // Pre-select first section if available
                      if (currentPosition.sections.length > 0) {
                        setNewCritSectionId(currentPosition.sections[0].id);
                      } else {
                        setNewCritSectionId('');
                      }
                      setShowAddCriterionModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-extrabold text-xs rounded-lg border border-indigo-100/20 active:scale-95 transition-all"
                  >
                    <Plus size={14} />
                    + Criterion
                  </button>
                </div>
              </div>

              {/* DYNAMIC DESIGNER VIEW */}
              <div className="space-y-6">
                
                {/* 1. SECTIONS IN ORDER */}
                {[...currentPosition.sections]
                  .sort((a, b) => a.order - b.order)
                  .map((sec, idx, sortedSecs) => {
                    const secCriteria = currentPosition.criteria
                      .filter(c => c.sectionId === sec.id)
                      .sort((a, b) => a.order - b.order);
                    const isCollapsed = collapsedSections[sec.id] || false;

                    return (
                      <div
                        key={sec.id}
                        draggable
                        onDragStart={(e) => handleSectionDragStart(e, sec.id)}
                        onDragOver={(e) => handleSectionDragOver(e, sec.id)}
                        onDrop={(e) => handleSectionDrop(e, sec.id)}
                        className={`bg-white dark:bg-slate-900 rounded-2xl border ${
                          draggedSectionId === sec.id 
                            ? 'border-indigo-500 border-dashed bg-indigo-50/10' 
                            : 'border-slate-200 dark:border-slate-800'
                        } shadow-sm overflow-hidden transition-all`}
                      >
                        {/* Section Header with Drag Handle, inputs, collapse and delete */}
                        <div 
                          className="p-4 bg-slate-50/60 dark:bg-slate-900/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 cursor-move"
                          title="Drag to reorder section"
                        >
                          {/* Left: Drag dots, section name edit fields */}
                          <div className="flex gap-3 items-center w-full md:w-auto">
                            <div className="text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600">
                              <Menu size={16} />
                            </div>
                            
                            {/* Inputs for inline editing section names */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto">
                              <input
                                type="text"
                                value={sec.nameKh}
                                placeholder="Khmer Section Name"
                                onChange={(e) => handleEditSectionName(sec.id, 'nameKh', e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-extrabold text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-48"
                              />
                              <input
                                type="text"
                                value={sec.nameEn}
                                placeholder="English Section Name"
                                onChange={(e) => handleEditSectionName(sec.id, 'nameEn', e.target.value)}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-48"
                              />
                            </div>
                          </div>

                          {/* Right: controls (reorder button, collapse toggle, delete section) */}
                          <div className="flex gap-2 items-center self-end md:self-auto text-slate-400">
                            {/* Reorder Arrows fallback */}
                            <button
                              disabled={idx === 0}
                              onClick={() => moveSectionOrder(idx, 'up')}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30"
                              title="Move section up"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              disabled={idx === sortedSecs.length - 1}
                              onClick={() => moveSectionOrder(idx, 'down')}
                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30"
                              title="Move section down"
                            >
                              <ArrowDown size={14} />
                            </button>
                            
                            <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

                            <button
                              onClick={() => toggleSectionCollapse(sec.id)}
                              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700"
                              title={isCollapsed ? "Expand Section" : "Collapse Section"}
                            >
                              {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                            </button>
                            
                            <button
                              onClick={() => handleDeleteSection(sec.id)}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                              title="Delete Section"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Section criteria body */}
                        {!isCollapsed && (
                          <div 
                            onDragOver={handleCritDragOver}
                            onDrop={(e) => handleCritDrop(e, sec.id)}
                            className="p-4 space-y-4 bg-slate-50/20 dark:bg-slate-950/10 min-h-[50px] divide-y divide-slate-100 dark:divide-slate-800"
                          >
                            {secCriteria.map((crit, cIdx) => (
                              <div
                                key={crit.id}
                                draggable
                                onDragStart={(e) => handleCritDragStart(e, crit.id)}
                                className="pt-4 first:pt-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group"
                              >
                                {/* Drag handle & Title inputs */}
                                <div className="flex gap-2.5 items-start w-full md:w-auto">
                                  <div className="text-slate-300 group-hover:text-slate-500 cursor-grab py-2">
                                    <Menu size={14} />
                                  </div>
                                  
                                  {/* Inputs for Title Edit */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full md:w-auto">
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-slate-400 font-bold block">Khmer Title / ខ្មែរ</span>
                                      <input
                                        type="text"
                                        value={crit.nameKh}
                                        onChange={(e) => handleUpdateCriterion(crit.id, { nameKh: e.target.value })}
                                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-extrabold text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-56"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <span className="text-[10px] text-slate-400 font-bold block">English Title / អង់គ្លេស</span>
                                      <input
                                        type="text"
                                        value={crit.nameEn}
                                        onChange={(e) => handleUpdateCriterion(crit.id, { nameEn: e.target.value })}
                                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-56"
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Score setting, section changer, duplicate and delete */}
                                <div className="flex gap-3 items-center justify-between w-full md:w-auto text-slate-400 self-end md:self-auto">
                                  {/* Max Score Input */}
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-slate-400 font-bold block">Max Score</span>
                                    <input
                                      type="number"
                                      value={crit.maxScore}
                                      onChange={(e) => handleUpdateCriterion(crit.id, { maxScore: Number(e.target.value) || 10 })}
                                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-bold text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-16 text-center"
                                    />
                                  </div>

                                  {/* Section selection modifier */}
                                  <div className="space-y-1">
                                    <span className="text-[10px] text-slate-400 font-bold block">Section</span>
                                    <select
                                      value={crit.sectionId}
                                      onChange={(e) => handleUpdateCriterion(crit.id, { sectionId: e.target.value })}
                                      className="px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-xs outline-none focus:ring-1 focus:ring-indigo-500 w-28"
                                    >
                                      <option value="">Uncategorized</option>
                                      {currentPosition.sections.map(s => (
                                        <option key={s.id} value={s.id}>{s.nameEn}</option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Order controller arrows fallback */}
                                  <div className="flex items-center gap-1 mt-4">
                                    <button
                                      disabled={cIdx === 0}
                                      onClick={() => moveCriterionOrder(crit.id, sec.id, 'up')}
                                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30"
                                      title="Move up"
                                    >
                                      <ArrowUp size={12} />
                                    </button>
                                    <button
                                      disabled={cIdx === secCriteria.length - 1}
                                      onClick={() => moveCriterionOrder(crit.id, sec.id, 'down')}
                                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-30"
                                      title="Move down"
                                    >
                                      <ArrowDown size={12} />
                                    </button>
                                  </div>

                                  {/* Duplicate / delete */}
                                  <div className="flex items-center gap-1 mt-4">
                                    <button
                                      onClick={() => handleDuplicateCriterion(crit)}
                                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                      title="Duplicate Criterion"
                                    >
                                      <Copy size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteCriterion(crit.id)}
                                      className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                                      title="Delete Criterion"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {secCriteria.length === 0 && (
                              <div className="py-4 text-center text-xs text-slate-400 font-bold">
                                No criteria in this section. Drag criteria here or click "+ Criterion".
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                {/* 2. UNCATEGORIZED CRITERIA PANEL */}
                {currentPosition.criteria.some(c => !c.sectionId) && (
                  <div className="bg-amber-50/30 dark:bg-amber-950/10 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 p-5 space-y-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                      <h3 className="font-extrabold text-sm text-amber-800 dark:text-amber-400">Uncategorized Criteria / លក្ខណៈវាយតម្លៃមិនទាន់បានចាត់ក្រុម</h3>
                    </div>
                    
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-500 font-bold leading-normal">
                      The criteria below have no section assigned. Use the dropdown selector on the right to assign them to an active section. They will instantly move inside.
                    </p>

                    <div className="divide-y divide-amber-100/30 dark:divide-amber-900/10 space-y-4">
                      {currentPosition.criteria
                        .filter(c => !c.sectionId)
                        .map((crit, idx) => (
                          <div key={crit.id} className="pt-4 first:pt-0 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <div>
                              <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-100">{crit.nameKh}</h4>
                              <p className="text-[11px] text-slate-400 font-bold mt-0.5">{crit.nameEn}</p>
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Move to section selector */}
                              <div className="space-y-0.5">
                                <span className="text-[9px] text-slate-400 font-extrabold block uppercase tracking-wider">Move to Section</span>
                                <select
                                  onChange={(e) => {
                                    handleUpdateCriterion(crit.id, { sectionId: e.target.value });
                                    toast.success('Criterion assigned and categorized!');
                                  }}
                                  className="px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-bold text-xs outline-none focus:ring-1 focus:ring-amber-500 w-44"
                                  value=""
                                >
                                  <option value="">-- Choose Section --</option>
                                  {currentPosition.sections.map(s => (
                                    <option key={s.id} value={s.id}>{s.nameEn}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Delete button */}
                              <button
                                onClick={() => handleDeleteCriterion(crit.id)}
                                className="p-2 mt-4 text-rose-500 hover:bg-rose-50 rounded-lg"
                                title="Delete criterion"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-full flex items-center justify-center">
                <Briefcase size={32} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-700 dark:text-slate-200">No Position Form Selected</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Select an evaluation template position from the left side panel, or click "+ Create Position Form" to design a brand new template.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: CREATE NEW POSITION */}
      {showAddPositionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6 space-y-5">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Create New Position Form</h3>
              <p className="text-xs text-slate-400 mt-1">Design a brand new custom evaluation template for a unique role.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Position Name</label>
                <input
                  type="text"
                  placeholder="e.g. Chief Operations Officer, Senior Registrar"
                  value={newPositionName}
                  onChange={(e) => setNewPositionName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Weighting Scheme</label>
                <select
                  value={newPositionWeightScheme}
                  onChange={(e) => setNewPositionWeightScheme(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {WEIGHTING_SCHEMES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Evaluation Type</label>
                <select
                  value={newPositionEvaluationType}
                  onChange={(e) => setNewPositionEvaluationType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {EVALUATION_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowAddPositionModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPosition}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/15 transition-all"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD SECTION */}
      {showAddSectionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6 space-y-5">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Add New Evaluation Section</h3>
              <p className="text-xs text-slate-400 mt-1">Insert a new category section to group criteria (e.g. Attitude, Job Knowledge).</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Section Name (Khmer / ខ្មែរ)</label>
                <input
                  type="text"
                  placeholder="e.g. អាកប្បកិរិយា និងក្រមសីលធម៌"
                  value={newSectionKh}
                  onChange={(e) => setNewSectionKh(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Section Name (English / អង់គ្លេស)</label>
                <input
                  type="text"
                  placeholder="e.g. Attitude & Professional Conduct"
                  value={newSectionEn}
                  onChange={(e) => setNewSectionEn(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowAddSectionModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSection}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/15 transition-all"
              >
                Add Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD CRITERION */}
      {showAddCriterionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-md w-full p-6 space-y-5">
            <div>
              <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-100">Add New Evaluation Criterion</h3>
              <p className="text-xs text-slate-400 mt-1">Specify an individual key performance indicator (KPI) metric statement.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Criterion Statement (Khmer / ខ្មែរ)</label>
                <input
                  type="text"
                  placeholder="e.g. ការគោរពវិន័យ និងម៉ោងធ្វើការ"
                  value={newCritKh}
                  onChange={(e) => setNewCritKh(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Criterion Statement (English / អង់គ្លេស)</label>
                <input
                  type="text"
                  placeholder="e.g. Adherence to discipline and standard work hours"
                  value={newCritEn}
                  onChange={(e) => setNewCritEn(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Maximum Score</label>
                  <select
                    value={newCritMaxScore}
                    onChange={(e) => setNewCritMaxScore(Number(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value={5}>5 Points</option>
                    <option value={10}>10 Points</option>
                    <option value={20}>20 Points</option>
                    <option value={100}>100 Points</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Assigned Section</label>
                  <select
                    value={newCritSectionId}
                    onChange={(e) => setNewCritSectionId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Uncategorized</option>
                    {currentPosition?.sections.map(s => (
                      <option key={s.id} value={s.id}>{s.nameEn}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowAddCriterionModal(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCriterion}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-indigo-600/15 transition-all"
              >
                Add Criterion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
