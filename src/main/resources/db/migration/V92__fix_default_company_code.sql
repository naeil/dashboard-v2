UPDATE company
SET company_code = generate_company_code()
WHERE id <> 1
  AND company_code = 'NVPZ7';

UPDATE company
SET company_code = 'NVPZ7'
WHERE id = 1;
