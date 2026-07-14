import { apiFetch } from '../mockApi';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export interface Criterion {
  id: number;
  kh: string;
  khDesc: string;
  en: string;
  desc: string;
  max: number;
}

export interface SelfEvalProfile {
  id: string;
  name: string;
  department: string;
  campus: string;
  position: string;
  category: string;
  evaluationType: string;
  evaluationPeriod: string;
  criteria: Criterion[];
}

export interface EvaluationType {
  id: string;
  label: string;
}

export interface WeightingScheme {
  id: string;
  label: string;
}

export interface EvaluationConfig {
  types: EvaluationType[];
  weightingSchemes: WeightingScheme[];
  criteriaSets: Record<string, Criterion[]>;
}

export function useSettings() {
  const [config, setConfig] = useState<EvaluationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  const fetchSettings = async () => {
    if (!token) return;
    try {
      const res = await apiFetch('/api/settings/evaluation_config', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.types && data.criteriaSets) {
          setConfig(data);
        } else {
          // Provide default structure
          setConfig({
            types: [],
            weightingSchemes: [],
            criteriaSets: {}
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const saveSettings = async (newConfig: EvaluationConfig) => {
    try {
      const res = await apiFetch('/api/settings/evaluation_config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newConfig)
      });
      if (res.ok) {
        setConfig(newConfig);
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  return { config, loading, saveSettings, refresh: fetchSettings };
}

export interface EvaluationSection {
  id: string;
  nameKh: string;
  nameEn: string;
  weight: number;
  order: number;
  status: 'Active' | 'Inactive';
  positions: string[];
}

export interface EvaluationCriterion {
  id: string;
  nameKh: string;
  nameEn: string;
  sectionId: string;
  positions: string[];
  maxScore: number;
  order: number;
  status: 'Active' | 'Inactive';
}

export const PREDEFINED_POSITIONS = [
  'Management',
  'Central Officer',
  'Supervisor',
  'HR',
  'Administrator',
  'Registrar',
  'Accountant',
  'Stock Controller',
  'Uniform Seller',
  'Customer Service',
  'Student Affairs',
  'Nurse',
  'Laboratory Assistant',
  'Librarian',
  'GEP Officer',
  'Teaching Assistant (TA)',
  'Nanny',
  'Discipline Officer'
];

export function useDynamicCriteria() {
  const [sections, setSections] = useState<EvaluationSection[]>([]);
  const [criteria, setCriteria] = useState<EvaluationCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  const fetchData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [secRes, critRes] = await Promise.all([
        apiFetch('/api/settings/evaluation_sections', { headers: { Authorization: `Bearer ${token}` } }),
        apiFetch('/api/settings/evaluation_criteria', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      let secs: EvaluationSection[] = [];
      let crits: EvaluationCriterion[] = [];

      if (secRes.ok) {
        const data = await secRes.json();
        secs = Array.isArray(data) ? data : [];
      }
      if (critRes.ok) {
        const data = await critRes.json();
        crits = Array.isArray(data) ? data : [];
      }

      // If empty, seed default sections and criteria
      if (secs.length === 0) {
        secs = [
          {
            id: 'sec_1',
            nameKh: 'អាកប្បកិរិយា និងក្រមសីលធម៌',
            nameEn: 'Attitude & Conduct',
            weight: 20,
            order: 1,
            status: 'Active',
            positions: [...PREDEFINED_POSITIONS]
          },
          {
            id: 'sec_2',
            nameKh: 'ចំណេះដឹង និងគុណភាពការងារ',
            nameEn: 'Professional Competence & Quality',
            weight: 40,
            order: 2,
            status: 'Active',
            positions: [...PREDEFINED_POSITIONS]
          },
          {
            id: 'sec_3',
            nameKh: 'ទំនាក់ទំនង និងការធ្វើការងារជាក្រុម',
            nameEn: 'Teamwork & Communication',
            weight: 20,
            order: 3,
            status: 'Active',
            positions: [...PREDEFINED_POSITIONS]
          },
          {
            id: 'sec_4',
            nameKh: 'ការគ្រប់គ្រង និងវិន័យ',
            nameEn: 'Responsibility & Discipline',
            weight: 20,
            order: 4,
            status: 'Active',
            positions: [...PREDEFINED_POSITIONS]
          }
        ];
      }

      if (crits.length === 0) {
        crits = [
          // Section 1
          {
            id: 'crit_1_1',
            nameKh: 'ការគោរពវិន័យ និងម៉ោងធ្វើការ',
            nameEn: 'Discipline and working hours',
            sectionId: 'sec_1',
            positions: [...PREDEFINED_POSITIONS],
            maxScore: 10,
            order: 1,
            status: 'Active'
          },
          {
            id: 'crit_1_2',
            nameKh: 'ភាពស្មោះត្រង់ និងក្រមសីលធម៌វិជ្ជាជីវៈ',
            nameEn: 'Integrity and professional ethics',
            sectionId: 'sec_1',
            positions: [...PREDEFINED_POSITIONS],
            maxScore: 10,
            order: 2,
            status: 'Active'
          },
          // Section 2
          {
            id: 'crit_2_1',
            nameKh: 'ការយល់ដឹងពីភារកិច្ច និងជំនាញការងារ',
            nameEn: 'Understanding of duties and work skills',
            sectionId: 'sec_2',
            positions: [...PREDEFINED_POSITIONS],
            maxScore: 10,
            order: 1,
            status: 'Active'
          },
          {
            id: 'crit_2_2',
            nameKh: 'ប្រសិទ្ធភាព និងភាពត្រឹមត្រូវនៃការងារ',
            nameEn: 'Efficiency and accuracy of work',
            sectionId: 'sec_2',
            positions: [...PREDEFINED_POSITIONS],
            maxScore: 10,
            order: 2,
            status: 'Active'
          },
          // Section 3
          {
            id: 'crit_3_1',
            nameKh: 'ការសហការល្អជាមួយសហការី និងថ្នាក់ដឹកនាំ',
            nameEn: 'Good cooperation with colleagues and leaders',
            sectionId: 'sec_3',
            positions: [...PREDEFINED_POSITIONS],
            maxScore: 10,
            order: 1,
            status: 'Active'
          },
          {
            id: 'crit_3_2',
            nameKh: 'ការទំនាក់ទំនង និងបដិសណ្ឋារកិច្ច',
            nameEn: 'Communication and hospitality',
            sectionId: 'sec_3',
            positions: [...PREDEFINED_POSITIONS],
            maxScore: 10,
            order: 2,
            status: 'Active'
          },
          // Section 4
          {
            id: 'crit_4_1',
            nameKh: 'គំនិតផ្តួចផ្តើម និងការដោះស្រាយបញ្ហា',
            nameEn: 'Initiative and problem solving',
            sectionId: 'sec_4',
            positions: [...PREDEFINED_POSITIONS],
            maxScore: 10,
            order: 1,
            status: 'Active'
          },
          {
            id: 'crit_4_2',
            nameKh: 'ការទទួលខុសត្រូវខ្ពស់លើការងារ',
            nameEn: 'High responsibility for work',
            sectionId: 'sec_4',
            positions: [...PREDEFINED_POSITIONS],
            maxScore: 10,
            order: 2,
            status: 'Active'
          }
        ];
      }

      setSections(secs.sort((a, b) => a.order - b.order));
      setCriteria(crits.sort((a, b) => a.order - b.order));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const saveAll = async (newSections: EvaluationSection[], newCriteria: EvaluationCriterion[]) => {
    try {
      const [secRes, critRes] = await Promise.all([
        apiFetch('/api/settings/evaluation_sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(newSections)
        }),
        apiFetch('/api/settings/evaluation_criteria', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(newCriteria)
        })
      ]);

      if (secRes.ok && critRes.ok) {
        setSections(newSections.sort((a, b) => a.order - b.order));
        setCriteria(newCriteria.sort((a, b) => a.order - b.order));
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  return { sections, criteria, loading, saveAll, refresh: fetchData };
}

export function useSelfEvalSettings() {
  const [profiles, setProfiles] = useState<SelfEvalProfile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const { token } = useAuth();

  const fetchProfiles = async () => {
    if (!token) return;
    try {
      const res = await apiFetch('/api/settings/self_eval_profiles', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setProfiles(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [token]);

  const saveProfiles = async (newProfiles: SelfEvalProfile[]) => {
    try {
      const res = await apiFetch('/api/settings/self_eval_profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newProfiles)
      });
      if (res.ok) {
        setProfiles(newProfiles);
        return true;
      }
    } catch (e) {
      console.error(e);
    }
    return false;
  };

  return { profiles, loading, saveProfiles, refresh: fetchProfiles };
}
