import fs from 'fs';

let content = fs.readFileSync('src/views/EmployeeProfiles.tsx', 'utf-8');

const targetStr = `  const handleDownloadTemplate = () => {
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
  };`;

const newStr = `  const handleDownloadTemplate = () => {
    const data = [{
      'Staff ID': 'EMP001',
      'Employee Name': 'John Doe',
      'Khmer Name': 'សុខ សាន្ត',
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
      'Status': 'Active'
    }];
    const ws = XLSX.utils.json_to_sheet(data);
    // Add column widths
    ws['!cols'] = [
      { wch: 12 }, { wch: 20 }, { wch: 20 }, { wch: 15 }, 
      { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, 
      { wch: 15 }, { wch: 20 }, { wch: 45 }, { wch: 20 },
      { wch: 18 }, { wch: 10 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "employee_import_template.xlsx");
  };`;

content = content.replace(targetStr, newStr);
fs.writeFileSync('src/views/EmployeeProfiles.tsx', content);
