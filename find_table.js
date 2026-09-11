const fs = require('fs');
const data = JSON.parse(fs.readFileSync('C:\\Users\\marekz\\.gemini\\antigravity\\brain\\18b6e128-65eb-4544-80ec-b992edbc631a\\.system_generated\\steps\\1051\\output.txt', 'utf8'));
const table = data.tables.find(t => t.name === 'public.business_clients');
console.log(JSON.stringify(table, null, 2));
