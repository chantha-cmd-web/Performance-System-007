import fs from 'fs';

let content = fs.readFileSync('src/views/EmployeeProfiles.tsx', 'utf-8');

const newStr = `  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          
          if (existingIds.has(staffId) || newIdsInImport.has(staffId)) {
            errors.push({ row: rowNum, id: staffId, message: 'Duplicate Staff ID found' });
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

          const emp = {
            id: staffId,
            name: String(row['Employee Name'] || row['name'] || '').trim(),
            khmerName: String(row['Khmer Name'] || row['khmerName'] || '').trim(),
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
          };

          try {
            const res = await apiFetch('/api/employees', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                Authorization: \`Bearer \${token}\` 
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
  };`;

// Replace using regex
const regex = /const handleFileUpload = async \(e: React\.ChangeEvent<HTMLInputElement>\) => \{[\s\S]*?if \(fileInputRef\.current\) fileInputRef\.current\.value = '';\n  \};/m;
content = content.replace(regex, newStr);

fs.writeFileSync('src/views/EmployeeProfiles.tsx', content);
